import { genAI, tools } from '../config/ai';
import { HarmCategory, HarmBlockThreshold, GenerativeModel, ChatSession } from '@google/generative-ai';
import config from '../config';
import toolService from './toolService';
import logger from '../utils/logger';
import ConfigProvider from '../core/config/ConfigProvider';
import systemLogModel from '../models/systemLogModel';
import { SystemPromptBuilder } from '../core/ai/PromptBuilder';
import appointmentService from './appointmentService';

export class AIService {
  constructor() { }

  /**
   * Inicializa el modelo usando la memoria RAM (Cero Queries)
   * Retorna una instancia de modelo configurada para este usuario/contexto.
   */
  public async initializeModel(leadData: any, hasMedia: boolean = false): Promise<GenerativeModel> {
    logger.info(`[IA] Inicializando instancia de modelo para ${leadData?.phone}...`);

    // Obtener configuración inmutable desde RAM
    const appConfig = ConfigProvider.getConfig();
    const catalogArray = ConfigProvider.getCatalogArray();

    // Obtener citas activas para el contexto de cambio/cancelación
    const activeAppts = await appointmentService.getActiveAppointmentsByPhone(leadData?.phone);

    // Construir el Prompt Maestro Modularmente
    const promptBuilder = new SystemPromptBuilder()
      .setPersona() // Hardcoded
      .setLeadContext(leadData?.name, leadData?.current_step)
      .setMedicalHistory(leadData?.medical_history)
      .setCatalog(catalogArray)
      .setOperations(appConfig)
      .setActiveAppointments(activeAppts)
      .setMultimodalInstructions(hasMedia)
      .setMasterInstructions(); // Hardcoded

    const systemInstruction = promptBuilder.build();
    const components = promptBuilder.getComponents();

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ];

    const modelObj = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      tools: [tools] as any,
      systemInstruction,
      safetySettings,
    });

    // Auditoría de Tokens detallada (Medición Aislada para precisión)
    try {
      const counterModel = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const keys = Object.keys(components);

      // 1. Medir componentes de texto y el total integrado del modelo (Prompt + Tools)
      const [tokenCounts, totalTextResult, totalModelResult] = await Promise.all([
        Promise.all(keys.map(k => counterModel.countTokens(components[k]))),
        counterModel.countTokens(systemInstruction),
        modelObj.countTokens("") // Peso total en el modelo (SystemInstruction + TOOLS)
      ]);

      const totalTokens = totalModelResult.totalTokens;
      logger.info(`📊 [IA - TOKENS] Desglose del System Prompt (${totalTokens} tokens total):`);

      // 2. Mostrar componentes del PromptBuilder
      keys.forEach((key, i) => {
        const tokens = tokenCounts[i].totalTokens;
        const percentage = totalTokens > 0 ? ((tokens / totalTokens) * 100).toFixed(1) : "0";
        logger.info(`   ↳ ${key.padEnd(6)} | ${tokens.toString().padStart(4)} tkn | ${percentage}%`);
      });

      // 3. Calcular y mostrar peso de TOOLS por diferencia
      const toolTokens = Math.max(0, totalTokens - totalTextResult.totalTokens);
      const toolPercentage = totalTokens > 0 ? ((toolTokens / totalTokens) * 100).toFixed(1) : "0";
      logger.info(`   ↳ TOOLS  | ${toolTokens.toString().padStart(4)} tkn | ${toolPercentage}%`);

      if (totalTokens > 8000) {
        logger.warn(`⚠️ [IA - OPTIMIZACIÓN] El System Prompt es pesado (${totalTokens} tkn). Se recomienda revisión.`);
      }
    } catch (countError) {
      logger.error('Error en auditoría de tokens', { countError });
    }

    return modelObj;
  }

  /**
   * Alias para inicialización rápida
   */
  public async prepareContext(leadData: any, hasMedia: boolean = false): Promise<GenerativeModel> {
    return await this.initializeModel(leadData, hasMedia);
  }

  /**
   * Genera un mensaje proactivo personalizado para un lead frío
   */
  public async generateProactiveHook(leadData: any): Promise<string> {
    const { name, summary, medical_history, phone } = leadData;
    const history = medical_history as any;
    const petNames = history?.pets?.map((p: any) => p.name).join(', ') || 'su mascota';

    const prompt = `
      Actúa como Miel, la asistente de Pet Care Studio. 
      Tengo un cliente llamado "${name || 'cliente'}" con el número ${phone}.
      Sabemos esto de él: "${summary || 'Mostró interés inicial'}".
      Tiene las siguientes mascotas: ${petNames}.

      El cliente no ha respondido en varias horas y no ha agendado su cita aún. 
      Genera un mensaje de WhatsApp corto, amable y MUY proactivo para retomar la conversación.

      REGLAS:
      - Sé empático y servicial.
      - Menciona a su mascota por nombre si es posible.
      - Ofrece ayuda con dudas o menciona disponibilidad.
      - Máximo 2-3 frases. 
      - No uses lenguaje robótico.
      - IMPORTANTE: No respondas con [SILENCIO] ni etiquetas de humor. Solo el texto del mensaje sugerido.
    `;

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return this._cleanupModelResponse(response.text());
    } catch (error) {
      logger.error(`Error generando gancho proactivo para ${phone}:`, error);
      return `Hola ${name || ''}, ¡espero que estés bien! Te escribía para saber si tenías alguna duda sobre nuestros servicios para ${petNames}. ¡Quedo atenta!`;
    }
  }

  private _cleanupModelResponse(text: string): string {
    if (!text) return '';
    let cleaned = text.toString();

    // 1. Eliminar bloques de pensamiento XML <thought>...</thought> o <thinking>
    cleaned = cleaned.replace(/<(thought|thinking)>[\s\S]*?<\/\1>/gim, '');
    cleaned = cleaned.replace(/<(thought|thinking)>[\s\S]*$/gim, '');

    // 2. Eliminar headers de pensamiento de estilo plano y guía de Gemini
    const thoughtHeaders = /^(引导|Guidance|Thought|Reflexión|Análisis|Pensamiento|Analísis|Thinking):.*$/gim;
    cleaned = cleaned.replace(thoughtHeaders, '');

    // 3. Eliminar rastro de prefijos de identidad (ej: "Miel: " o "Asistente: ")
    cleaned = cleaned.replace(/^(Miel|Asistente|AI|Bot):\s*/gi, '');

    // 4. Eliminar llamadas a funciones accidentales o bloques de código
    cleaned = cleaned.replace(/^[a-z_]+\(.*\)$/gm, '');
    cleaned = cleaned.replace(/```[a-z]*[\s\S]*?```/g, '');

    // 5. Limpieza final de espacios y saltos de línea excesivos
    return cleaned.replace(/\n{3,}/g, '\n\n').trim();
  }

  private _filterSafetyFalsePositives(text: string): string {
    if (!text) return text;
    // Evita falsos positivos críticos (Ej: mascotas llamadas "Loli")
    return text.toString()
      .replace(/\b[lL]oli\b/g, 'Loly')
      .replace(/\b[lL]OL[iI]\b/g, 'LOLY');
  }

  /**
   * Genera una respuesta manejando el historial y posible contenido multimedia
   */
  public async generateResponse(model: GenerativeModel, message: string, history: any[] = [], media: any[] = []) {
    if (!model) throw new Error('IA no inicializada.');

    const safeMessage = this._filterSafetyFalsePositives(message);
    const sanitizedHistory = this._sanitizeHistory(history);

    /* logger.info(
      `[IA] Iniciando chat con historial sanitizado (${sanitizedHistory.length} msgs) y ${media.length} archivos media.`
    ); */

    const chatSession = model.startChat({
      history: sanitizedHistory,
    });

    // Construcción del mensaje multimodal
    const messageParts: any[] = [{ text: safeMessage }];

    // Agregar media Items (Imágenes o Audios)
    if (media && media.length > 0) {
      media.forEach((item, index) => {
        messageParts.push({
          inlineData: {
            data: item.data,
            mimeType: item.mimeType
          }
        });
        // logger.info(`[IA - MULTIMODAL] Adjuntando archivo #${index + 1} (${item.mimeType})`);
      });
    }

    /* logger.info(
      `[IA - PROCESANDO] Enviando prompt multimodal al modelo (Text: "${safeMessage.substring(0, 50)}...")`
    ); */

    const iaCallStart = Date.now();

    // Auditoría de Tokens de Entrada Dinámica (Costo de ejecución)
    try {
      const historyTokens = sanitizedHistory.length > 0
        ? (await model.countTokens({ contents: sanitizedHistory })).totalTokens
        : 0;

      const mediaParts = messageParts.filter(p => p.inlineData);
      const mediaTokens = mediaParts.length > 0
        ? (await model.countTokens({ contents: [{ role: 'user', parts: mediaParts }] })).totalTokens
        : 0;

      const systemResult = await model.countTokens(""); // System + Tools

      logger.info(`🔌 [IA - FLUJO ENTRADA] Desglose de carga para este mensaje:`);
      logger.info(`   ↳ MANUAL (Fijo)   | ${systemResult.totalTokens.toString().padStart(4)} tkn`);
      logger.info(`   ↳ MEMORIA (Hist)  | ${historyTokens.toString().padStart(4)} tkn`);
      if (mediaTokens > 0) logger.info(`   ↳ MULTIMEDIA     | ${mediaTokens.toString().padStart(4)} tkn`);
    } catch (err) {
      logger.error('Error en auditoría dinámica de tokens', { err });
    }

    const result = await this._withRetry(async () => {
      // sendMessage puede recibir un array de partes para multimodalidad
      return await chatSession.sendMessage(messageParts);
    });
    const iaDuration = ((Date.now() - iaCallStart) / 1000).toFixed(2);

    const usage = result?.response?.usageMetadata;
    if (usage) {
      const promptCost = (usage.promptTokenCount / 1000000) * 0.075;
      const candidatesCost = (usage.candidatesTokenCount / 1000000) * 0.30;
      const totalCost = (promptCost + candidatesCost).toFixed(5);

      logger.success(
        `💰 [COSTO TOTAL] Entrada: ${usage.promptTokenCount} | Salida: ${usage.candidatesTokenCount} | Total: $${totalCost} USD | ${iaDuration}s`
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
   * Orquesta la ejecución de varias herramientas en bucle hasta obtener texto
   */
  public async processFunctionCalls(calls: any[], chatSession: ChatSession, phone: string) {
    let currentCalls = calls;
    let finalResponse = { text: '', chatSession };

    // Bucle para manejar function calls anidados o múltiples
    while (currentCalls && currentCalls.length > 0) {
      const toolResponses = [];

      for (const call of currentCalls) {
        const toolName = call.name;
        const args = call.args;
        logger.info(`[TOOL] Ejecutando: ${toolName} para ${phone}`, { args });

        try {
          const toolResult = await (toolService as any)[toolName](args, phone);
          toolResponses.push({
            functionResponse: { name: toolName, response: toolResult },
          });
        } catch (error: any) {
          logger.error(`❌ [TOOL - ERROR] Error fatal en ${toolName}`, { error });

          // Registrar en DB para diagnóstico remoto
          await systemLogModel.log('error', `Fallo crítico en herramienta: ${toolName}`, phone, {
            tool: toolName,
            args
          }, error.stack);

          toolResponses.push({
            functionResponse: {
              name: toolName,
              response: { status: 'error', message: 'Error interno ejecutando herramienta.' },
            },
          });
        }
      }

      // Enviar todos los resultados de una vez con reintentos
      const toolIaCallStart = Date.now();
      const result = await this._withRetry(async () => {
        return await chatSession.sendMessage(toolResponses);
      });
      const toolIaDuration = ((Date.now() - toolIaCallStart) / 1000).toFixed(2);

      const usage = result.response.usageMetadata;
      if (usage) {
        const promptCost = (usage.promptTokenCount / 1000000) * 0.075;
        const candidatesCost = (usage.candidatesTokenCount / 1000000) * 0.30;
        const totalCost = (promptCost + candidatesCost).toFixed(5);

        logger.success(
          `💰 [TOKENS TOOL] Entrada: ${usage.promptTokenCount} | Salida: ${usage.candidatesTokenCount} | Costo: $${totalCost} USD | Duración: ${toolIaDuration}s`
        );
      }

      finalResponse.text = this._cleanupModelResponse(result.response.text());
      currentCalls = result.response.functionCalls();

      if (currentCalls && currentCalls.length > 0) {
        logger.info(
          `[IA] Gemini pidió más llamadas: ${currentCalls.map((c) => c.name).join(', ')}`
        );
      }
    }

    return finalResponse;
  }

  private _sanitizeHistory(history: any[]) {
    if (history.length === 0) return [];

    let sanitized = [...history];

    // 1. Quitar el último si es del usuario (porque se enviará en el prompt actual)
    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
      logger.info(
        `[IA] Historial ajustado: quitando último mensaje 'user' para evitar duplicidad.`
      );
      sanitized.pop();
    }

    // 2. Limitar tamaño (Poda Dinámica de Historial para ahorrar Tokens)
    // Solo enviamos los últimos 10 mensajes (cada uno puede ser un bloque agrupado)
    // La memoria a largo plazo se sostiene vía las actualizaciones en DB y el Prompt System.
    const MAX_HISTORY = 10;
    if (sanitized.length > MAX_HISTORY) {
      sanitized = sanitized.slice(-MAX_HISTORY);
    }

    // Asegurar que el primer mensaje sea 'user'
    let sliceIndex = 0;
    while (sliceIndex < sanitized.length && sanitized[sliceIndex].role !== 'user') {
      sliceIndex++;
    }
    const finalHistory = sanitized.slice(sliceIndex);

    // 3. Verificación de alternancia Gemini (user, model, user, model...)
    const alternatingHistory = [];
    for (const msg of finalHistory) {
      // Clonar profundamente el mensaje para no mutar el original
      const safeMsg = JSON.parse(JSON.stringify(msg));

      // 3. Limpieza de campos no soportados por la API de Google (mediaUrl, mediaType)
      // Whitelist de campos permitidos para evitar errores 400 Bad Request
      if (safeMsg.parts && Array.isArray(safeMsg.parts)) {
        safeMsg.parts = safeMsg.parts.map((p: any) => {
          // Si el objeto tiene rastros de campos de dashboard, lo convertimos a texto
          if ('mediaUrl' in p || 'mediaType' in p) {
            const typeLabel = (p.mediaType === 'image' || p.mediaUrl?.includes('image')) ? 'IMAGEN' : 'AUDIO';
            return { text: `[ARCHIVO MULTIMEDIA: ${typeLabel}]` };
          }

          // Whitelist estricta: solo permitimos campos oficiales del SDK de Gemini
          const cleanPart: any = {};
          if (p.text) cleanPart.text = this._filterSafetyFalsePositives(p.text);
          if (p.inlineData) cleanPart.inlineData = p.inlineData;
          if (p.functionCall) cleanPart.functionCall = p.functionCall;
          if (p.functionResponse) cleanPart.functionResponse = p.functionResponse;

          return Object.keys(cleanPart).length > 0 ? cleanPart : { text: "[Mensaje vacío]" };
        });
      }

      if (
        alternatingHistory.length > 0 &&
        alternatingHistory[alternatingHistory.length - 1].role === safeMsg.role
      ) {
        if (safeMsg.role === 'user' && safeMsg.parts && safeMsg.parts[0] && safeMsg.parts[0].text) {
          alternatingHistory[alternatingHistory.length - 1].parts[0].text +=
            ' ' + safeMsg.parts[0].text;
        }
      } else {
        alternatingHistory.push(safeMsg);
      }
    }

    return alternatingHistory;
  }

  /**
   * Envuelve una promesa con lógica de reintento exponencial
   */
  private async _withRetry(fn: any, maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Race contra un timeout de 20s
        return await Promise.race([
          fn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout de 20s en Gemini API')), 20000)
          ),
        ]);
      } catch (error: any) {
        lastError = error;
        // Solo reintentar si es un error de red o sobrecarga (500, 503, 429) o timeout
        const errorMsg = error.message?.toLowerCase() || '';
        const shouldRetry =
          errorMsg.includes('timeout') ||
          errorMsg.includes('fetch') ||
          errorMsg.includes('503') ||
          errorMsg.includes('429');

        if (!shouldRetry || i === maxRetries - 1) break;

        const delay = Math.pow(2, i) * 1000;
        logger.warn(`⚠️ [IA - REINTENTO] Intento ${i + 1} fallido. Reintentando en ${delay}ms...`, {
          error: error.message,
        });
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    throw lastError;
  }
}

export default new AIService();

