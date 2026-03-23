import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerativeModel, ChatSession } from '@google/generative-ai';
import { botConfig } from '../config/botConfig';
import toolService from './toolService';
import logger from '../utils/logger';
import { SystemPromptBuilder } from '../core/ai/PromptBuilder';

// Inicializar SDK con la Key Centralizada
export const genAI = new GoogleGenerativeAI(botConfig.geminiApiKey);

export class AIService {
  constructor() { }

  /**
   * Inicializa el modelo usando la memoria RAM y config monolítico
   */
  public async initializeModel(userData: any, hasMedia: boolean = false): Promise<GenerativeModel> {
    logger.info(`[IA] Inicializando modelo para usuario: ${userData?.name || 'Nuevo'}...`);

    // Construir el Prompt Maestro Modularmente
    const promptBuilder = new SystemPromptBuilder()
      .setPersona() 
      .setUserContext(userData?.name, userData?.preferences)
      .setCatalog()
      .setMultimodalInstructions(hasMedia)
      .setMasterInstructions(); 

    const systemInstruction = promptBuilder.build();

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const tools = botConfig.tools.functionDeclarations.length > 0 
      ? [{ functionDeclarations: botConfig.tools.functionDeclarations }] 
      : undefined;

    const modelObj = genAI.getGenerativeModel({
      model: botConfig.ai.modelName,
      tools: tools as any,
      systemInstruction,
      safetySettings,
    });

    return modelObj;
  }

  /**
   * Envía mensaje manejando el historial "mockeado" de la DB
   */
  public async generateResponse(model: GenerativeModel, message: string, history: any[] = [], media: any[] = []) {
    if (!model) throw new Error('IA no inicializada.');

    // Sanitiza y recorta el historial según botConfig
    const sanitizedHistory = this._sanitizeHistory(history);

    const chatSession = model.startChat({
      history: sanitizedHistory,
    });

    const messageParts: any[] = [{ text: message }];

    if (media && media.length > 0) {
      media.forEach((item) => {
        messageParts.push({
          inlineData: { data: item.data, mimeType: item.mimeType }
        });
      });
    }

    const iaCallStart = Date.now();

    const result = await this._withRetry(async () => {
      return await chatSession.sendMessage(messageParts);
    });
    
    const iaDuration = ((Date.now() - iaCallStart) / 1000).toFixed(2);
    
    // Log Costos (Simulado/Informativo)
    const usage = result?.response?.usageMetadata;
    if (usage) {
      logger.success(
        `[TOKENS] In: ${usage.promptTokenCount} | Out: ${usage.candidatesTokenCount} | ${iaDuration}s`
      );
    }

    const calls = result.response.functionCalls();
    return {
      functionCalls: calls,
      text: this._cleanupModelResponse(result.response.text()),
      chatSession,
    };
  }

  /**
   * Ejecuta Tools (Function Calling) dinámicamente conectando con toolService
   */
  public async processFunctionCalls(calls: any[], chatSession: ChatSession, phone: string) {
    let currentCalls = calls;
    const finalResponse = { text: '', chatSession };

    while (currentCalls && currentCalls.length > 0) {
      const toolResponses = [];

      for (const call of currentCalls) {
        const toolName = call.name;
        const args = call.args;

        logger.info(`[TOOL] Ejecutando: ${toolName}`, args);

        try {
          // Buscamos dinámicamente el método en toolService
          const executor = (toolService as any)[toolName];
          if (executor && typeof executor === 'function') {
             const toolResult = await executor.call(toolService, args, phone);
             toolResponses.push({
               functionResponse: { name: toolName, response: toolResult },
             });
          } else {
             logger.warn(`[TOOL - NOT FOUND] La función ${toolName} no existe en toolService.`);
             toolResponses.push({
               functionResponse: { name: toolName, response: { error: 'Tool not implemented' } },
             });
          }
        } catch (error: any) {
          logger.error(`[TOOL - ERROR] Falló ${toolName}`, { error });
          toolResponses.push({
            functionResponse: { name: toolName, response: { status: 'error', message: error.message } },
          });
        }
      }

      const result = await this._withRetry(async () => {
        return await chatSession.sendMessage(toolResponses);
      });

      finalResponse.text = this._cleanupModelResponse(result.response.text());
      currentCalls = result.response.functionCalls();
    }

    return finalResponse;
  }

  private _cleanupModelResponse(text: string): string {
    if (!text) return '';
    let cleaned = text.toString();
    cleaned = cleaned.replace(/<(thought|thinking)>[\s\S]*?<\/\1>/gim, '');
    cleaned = cleaned.replace(/<(thought|thinking)>[\s\S]*$/gim, '');
    cleaned = cleaned.replace(/^(Guidance|Thought|Reflexión|Análisis|Pensamiento|Thinking):.*$/gim, '');
    cleaned = cleaned.replace(/^(Asistente|AI|Bot):\s*/gi, '');
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  private _sanitizeHistory(history: any[]) {
    if (history.length === 0) return [];
    const sanitized = [...history];

    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
      sanitized.pop();
    }

    const alternatingHistory = [];
    for (const msg of sanitized) {
      const safeMsg = JSON.parse(JSON.stringify(msg));
      if (safeMsg.parts && Array.isArray(safeMsg.parts)) {
        safeMsg.parts = safeMsg.parts.map((p: any) => {
          const cleanPart: any = {};
          if (p.text) cleanPart.text = p.text;
          if (p.inlineData) cleanPart.inlineData = p.inlineData;
          if (p.functionCall) cleanPart.functionCall = p.functionCall;
          if (p.functionResponse) cleanPart.functionResponse = p.functionResponse;
          return Object.keys(cleanPart).length > 0 ? cleanPart : { text: "" };
        });
      }

      if (
        alternatingHistory.length > 0 &&
        alternatingHistory[alternatingHistory.length - 1].role === safeMsg.role
      ) {
        if (safeMsg.role === 'user' && safeMsg.parts[0]?.text) {
          alternatingHistory[alternatingHistory.length - 1].parts[0].text += ' ' + safeMsg.parts[0].text;
        }
      } else {
        alternatingHistory.push(safeMsg);
      }
    }
    return alternatingHistory;
  }

  private async _withRetry(fn: any, maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de 20s en Gemini API')), 20000)),
        ]);
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message?.toLowerCase() || '';
        const shouldRetry = errorMsg.includes('timeout') || errorMsg.includes('503') || errorMsg.includes('429');
        if (!shouldRetry || i === maxRetries - 1) break;
        const delay = Math.pow(2, i) * 1000;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    throw lastError;
  }
}

export default new AIService();
