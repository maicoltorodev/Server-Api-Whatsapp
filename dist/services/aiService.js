"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { genAI, tools } = require('../config/ai');
const { HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const config = require('../config');
const toolService = require('./toolService');
const logger = require('../utils/logger').default;
const ConfigProvider = require('../core/config/ConfigProvider').default;
const { SystemPromptBuilder } = require('../core/ai/PromptBuilder');
class AIService {
    constructor() { }
    /**
     * Inicializa el modelo usando la memoria RAM (Cero Queries)
     * Retorna una instancia de modelo configurada para este usuario/contexto.
     */
    async initializeModel(leadData) {
        logger.info(`[IA] Inicializando instancia de modelo para ${leadData?.phone}...`);
        // Obtener configuración inmutable desde RAM
        const appConfig = ConfigProvider.getConfig();
        const catalogString = ConfigProvider.getCatalogString();
        // Construir el Prompt Maestro Modularmente
        const systemInstruction = new SystemPromptBuilder()
            .setTimeContext(config.TIMEZONE)
            .setLeadContext(leadData?.current_step, leadData?.summary)
            .setMedicalHistory(leadData?.medical_history)
            .setCatalog(catalogString)
            .setOperations(appConfig)
            .setMasterInstructions(appConfig)
            .setHardcodedRules()
            .build();
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
            model: "gemini-flash-latest",
            tools: [tools],
            systemInstruction,
            safetySettings
        });
        logger.info(`[IA] Pre-Prompt Ensamblado: ${systemInstruction.length} caracteres.`);
        return modelObj;
    }
    /**
     * Alias para inicialización rápida
     */
    async prepareContext(leadData) {
        return await this.initializeModel(leadData);
    }
    /**
     * Genera una respuesta manejando el historial de forma segura
     */
    async generateResponse(model, message, history = []) {
        if (!model)
            throw new Error("IA no inicializada.");
        const sanitizedHistory = this._sanitizeHistory(history);
        logger.info(`[IA] Iniciando chat con historial sanitizado (${sanitizedHistory.length} msgs).`);
        const chatSession = model.startChat({
            history: sanitizedHistory
        });
        logger.info(`[IA] Enviando prompt: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
        const result = await this._withRetry(async () => {
            return await chatSession.sendMessage(message);
        });
        const usage = result?.response?.usageMetadata;
        if (usage) {
            logger.info(`[IA] Tokens: Prompt=${usage.promptTokenCount} | Respuesta=${usage.candidatesTokenCount} | Total=${usage.totalTokenCount}`);
        }
        const calls = result.response.functionCalls();
        if (calls && calls.length > 0) {
            logger.info(`[IA] Gemini respondió con CALL: ${calls.map(c => c.name).join(', ')}`);
        }
        else {
            logger.info(`[IA] Gemini respondió con TEXTO directamente.`);
        }
        return {
            functionCalls: calls,
            text: result.response.text(),
            chatSession
        };
    }
    /**
     * Orquesta la ejecución de varias herramientas en bucle hasta obtener texto
     */
    async processFunctionCalls(calls, chatSession, phone) {
        let currentCalls = calls;
        let finalResponse = { text: "", chatSession };
        // Bucle para manejar function calls anidados o múltiples
        while (currentCalls && currentCalls.length > 0) {
            const toolResponses = [];
            for (const call of currentCalls) {
                const toolName = call.name;
                const args = call.args;
                logger.info(`[TOOL] Executing: ${toolName} para ${phone}`);
                try {
                    const toolResult = await toolService[toolName](args, phone);
                    toolResponses.push({
                        functionResponse: { name: toolName, response: toolResult }
                    });
                }
                catch (error) {
                    logger.error(`[TOOL] Error fatal en ${toolName}`, { error });
                    toolResponses.push({
                        functionResponse: { name: toolName, response: { status: "error", message: "Error interno ejecutando herramienta." } }
                    });
                }
            }
            // Enviar todos los resultados de una vez con reintentos
            const result = await this._withRetry(async () => {
                return await chatSession.sendMessage(toolResponses);
            });
            const usage = result.response.usageMetadata;
            if (usage) {
                logger.info(`[IA] Tokens (Herramienta): Prompt=${usage.promptTokenCount} | Respuesta=${usage.candidatesTokenCount} | Total=${usage.totalTokenCount}`);
            }
            finalResponse.text = result.response.text();
            currentCalls = result.response.functionCalls();
            if (currentCalls && currentCalls.length > 0) {
                logger.info(`[IA] Gemini pidió más llamadas: ${currentCalls.map(c => c.name).join(', ')}`);
            }
        }
        return finalResponse;
    }
    _sanitizeHistory(history) {
        if (history.length === 0)
            return [];
        let sanitized = [...history];
        // 1. Quitar el último si es del usuario (porque se enviará en el prompt actual)
        if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
            logger.info(`[IA] Historial ajustado: quitando último mensaje 'user' para evitar duplicidad.`);
            sanitized.pop();
        }
        // 2. Limitar tamaño
        const MAX_HISTORY = 12;
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
            if (alternatingHistory.length > 0 && alternatingHistory[alternatingHistory.length - 1].role === msg.role) {
                if (msg.role === 'user' && msg.parts && msg.parts[0] && msg.parts[0].text) {
                    alternatingHistory[alternatingHistory.length - 1].parts[0].text += " " + msg.parts[0].text;
                }
            }
            else {
                alternatingHistory.push(msg);
            }
        }
        return alternatingHistory;
    }
    /**
     * Envuelve una promesa con lógica de reintento exponencial
     */
    async _withRetry(fn, maxRetries = 3) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                // Race contra un timeout de 20s
                return await Promise.race([
                    fn(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de 20s en Gemini API")), 20000))
                ]);
            }
            catch (error) {
                lastError = error;
                // Solo reintentar si es un error de red o sobrecarga (500, 503, 429) o timeout
                const errorMsg = error.message?.toLowerCase() || "";
                const shouldRetry = errorMsg.includes('timeout') || errorMsg.includes('fetch') || errorMsg.includes('503') || errorMsg.includes('429');
                if (!shouldRetry || i === maxRetries - 1)
                    break;
                const delay = Math.pow(2, i) * 1000;
                logger.warn(`[IA] Intento ${i + 1} fallido. Reintentando en ${delay}ms...`, { error: error.message });
                await new Promise(res => setTimeout(res, delay));
            }
        }
        throw lastError;
    }
}
module.exports = new AIService();
