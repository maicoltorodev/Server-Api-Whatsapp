"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = exports.genAI = void 0;
const generative_ai_1 = require("@google/generative-ai");
const botConfig_1 = require("../config/botConfig");
const toolService_1 = __importDefault(require("./toolService"));
const logger_1 = __importDefault(require("../utils/logger"));
const PromptBuilder_1 = require("../core/ai/PromptBuilder");
// Inicializar SDK con la Key Centralizada
exports.genAI = new generative_ai_1.GoogleGenerativeAI(botConfig_1.botConfig.geminiApiKey);
class AIService {
    constructor() { }
    /**
     * Inicializa el modelo de IA con el protocolo completo de Nexa.
     * @param userData Datos del usuario desde memoria
     * @param hasMedia Si el mensaje tiene multimedia
     * @param isNewUser Si es la primera interacción (historial vacío)
     */
    async initializeModel(userData, hasMedia = false, isNewUser = false) {
        logger_1.default.info(`[IA] Inicializando modelo para usuario: ${userData?.name || 'Nuevo'}...`);
        const promptBuilder = new PromptBuilder_1.SystemPromptBuilder()
            .setProtocol(isNewUser)
            .setUserContext(userData?.name, userData?.preferences)
            .setCatalog()
            .setMultimodalInstructions(hasMedia);
        const systemInstruction = promptBuilder.build();
        const safetySettings = [
            { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
            { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
            { category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
            { category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
        ];
        const tools = botConfig_1.botConfig.tools.functionDeclarations.length > 0
            ? [{ functionDeclarations: botConfig_1.botConfig.tools.functionDeclarations }]
            : undefined;
        const modelObj = exports.genAI.getGenerativeModel({
            model: botConfig_1.botConfig.ai.modelName,
            tools: tools,
            systemInstruction,
            safetySettings,
        });
        return modelObj;
    }
    /**
     * Envía mensaje manejando el historial "mockeado" de la DB
     */
    async generateResponse(model, message, history = [], media = []) {
        if (!model)
            throw new Error('IA no inicializada.');
        // Sanitiza y recorta el historial según botConfig
        const sanitizedHistory = this._sanitizeHistory(history);
        const chatSession = model.startChat({
            history: sanitizedHistory,
        });
        const messageParts = [{ text: message }];
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
            logger_1.default.success(`[TOKENS] In: ${usage.promptTokenCount} | Out: ${usage.candidatesTokenCount} | ${iaDuration}s`);
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
    async processFunctionCalls(calls, chatSession, phone) {
        let currentCalls = calls;
        const finalResponse = { text: '', chatSession };
        while (currentCalls && currentCalls.length > 0) {
            const toolResponses = [];
            for (const call of currentCalls) {
                const toolName = call.name;
                const args = call.args;
                logger_1.default.info(`[TOOL] Ejecutando: ${toolName}`, args);
                try {
                    // Buscamos dinámicamente el método en toolService
                    const executor = toolService_1.default[toolName];
                    if (executor && typeof executor === 'function') {
                        const toolResult = await executor.call(toolService_1.default, args, phone);
                        toolResponses.push({
                            functionResponse: { name: toolName, response: toolResult },
                        });
                    }
                    else {
                        logger_1.default.warn(`[TOOL - NOT FOUND] La función ${toolName} no existe en toolService.`);
                        toolResponses.push({
                            functionResponse: { name: toolName, response: { error: 'Tool not implemented' } },
                        });
                    }
                }
                catch (error) {
                    logger_1.default.error(`[TOOL - ERROR] Falló ${toolName}`, { error });
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
    _cleanupModelResponse(text) {
        if (!text)
            return '';
        let cleaned = text.toString();
        cleaned = cleaned.replace(/<(thought|thinking)>[\s\S]*?<\/\1>/gim, '');
        cleaned = cleaned.replace(/<(thought|thinking)>[\s\S]*$/gim, '');
        cleaned = cleaned.replace(/^(Guidance|Thought|Reflexión|Análisis|Pensamiento|Thinking):.*$/gim, '');
        cleaned = cleaned.replace(/^(Asistente|AI|Bot):\s*/gi, '');
        return cleaned.replace(/\n{3,}/g, '\n\n').trim();
    }
    _sanitizeHistory(history) {
        if (history.length === 0)
            return [];
        const sanitized = [...history];
        if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
            sanitized.pop();
        }
        const alternatingHistory = [];
        for (const msg of sanitized) {
            const safeMsg = JSON.parse(JSON.stringify(msg));
            if (safeMsg.parts && Array.isArray(safeMsg.parts)) {
                safeMsg.parts = safeMsg.parts.map((p) => {
                    const cleanPart = {};
                    if (p.text)
                        cleanPart.text = p.text;
                    if (p.inlineData)
                        cleanPart.inlineData = p.inlineData;
                    if (p.functionCall)
                        cleanPart.functionCall = p.functionCall;
                    if (p.functionResponse)
                        cleanPart.functionResponse = p.functionResponse;
                    return Object.keys(cleanPart).length > 0 ? cleanPart : { text: "" };
                });
            }
            if (alternatingHistory.length > 0 &&
                alternatingHistory[alternatingHistory.length - 1].role === safeMsg.role) {
                if (safeMsg.role === 'user' && safeMsg.parts[0]?.text) {
                    alternatingHistory[alternatingHistory.length - 1].parts[0].text += ' ' + safeMsg.parts[0].text;
                }
            }
            else {
                alternatingHistory.push(safeMsg);
            }
        }
        return alternatingHistory;
    }
    async _withRetry(fn, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await Promise.race([
                    fn(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de 20s en Gemini API')), 20000)),
                ]);
            }
            catch (error) {
                lastError = error;
                const errorMsg = error.message?.toLowerCase() || '';
                const shouldRetry = errorMsg.includes('timeout') || errorMsg.includes('503') || errorMsg.includes('429');
                if (!shouldRetry || i === maxRetries - 1)
                    break;
                const delay = Math.pow(2, i) * 1000;
                await new Promise((res) => setTimeout(res, delay));
            }
        }
        throw lastError;
    }
}
exports.AIService = AIService;
exports.default = new AIService();
