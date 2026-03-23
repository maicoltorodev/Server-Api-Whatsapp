"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationService = void 0;
const memoryAdapter_1 = __importDefault(require("../core/memoryAdapter"));
const aiService_1 = __importDefault(require("./aiService"));
const whatsappService_1 = __importDefault(require("./whatsappService"));
const logger_1 = __importDefault(require("../utils/logger"));
class ConversationService {
    /**
     * Procesa un mensaje entrante de un cliente de principio a fin
     */
    async handleIncomingMessage(phone, message, media = [], lastMsgId) {
        logger_1.default.info(`🤖 [ORQUESTADOR] Iniciando proceso para: ${phone} | Media: ${media.length}`);
        // 1. Obtener o crear Usuario en Memoria (Mock CRM)
        let user = await memoryAdapter_1.default.getUser(phone);
        if (!user) {
            user = await memoryAdapter_1.default.createUser(phone, 'Usuario ' + phone.slice(-4));
        }
        else {
            await memoryAdapter_1.default.updateUser(phone, { lastInteraction: new Date() });
        }
        // 2. Obtener historial para alimentar a Gemini (No guardamos el nuevo mensaje aún)
        const pastHistory = await memoryAdapter_1.default.getHistory(phone);
        // 3. Verificar si el bot debe responder (Etapas)
        if (user.stage === 'DERIVADO_A_HUMANO') {
            logger_1.default.warn(`  ↳ Bot en PAUSA para ${phone}. El humano tiene el control.`);
            return { status: 'human_control' };
        }
        // 4. Activar Indicador de Escritura
        const typingStartedAt = Date.now();
        await whatsappService_1.default.sendTypingIndicator(phone, lastMsgId);
        // 5. Procesar con IA
        try {
            const hasMedia = media && media.length > 0;
            const isNewUser = pastHistory.length === 0;
            const model = await aiService_1.default.initializeModel(user, hasMedia, isNewUser);
            const aiResponse = await aiService_1.default.generateResponse(model, message, pastHistory, media);
            let responseText = '';
            if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
                logger_1.default.info(`La IA solicitó ejecutar herramientas: ${aiResponse.functionCalls.map((c) => c.name).join(', ')}`);
                const result = await aiService_1.default.processFunctionCalls(aiResponse.functionCalls, aiResponse.chatSession, phone);
                // Si la IA solo ejecutó tools y no generó texto posterior, usamos el texto previo al tool como fallback
                responseText = result.text || aiResponse.text || '';
            }
            else {
                responseText = aiResponse.text;
            }
            // --- 🧠 EXTRAER RESUMEN DE MULTIMEDIA (Si existe) ---
            let finalUserMessage = message;
            if (hasMedia && responseText) {
                const match = responseText.match(/^\[(RESUMEN:\s*(.*?))\]\s*\n?/i);
                if (match) {
                    finalUserMessage = `[${match[1]}]`; // Guardamos el resumen descriptivo
                    responseText = responseText.replace(match[0], '').trim(); // Removemos para el cliente
                    logger_1.default.info(`📸 [MULTIMEDIA RESUMEN EXTRACTO]: ${finalUserMessage}`);
                }
            }
            // Guardamos ahora sí el mensaje del usuario con su resumen
            await memoryAdapter_1.default.saveMessage(phone, 'user', finalUserMessage);
            if (responseText.toUpperCase().includes('[SILENCIO]')) {
                logger_1.default.info(`🤫 [IA] Decidió hacer SILENCIO. Abortando envío.`);
                await memoryAdapter_1.default.saveMessage(phone, 'model', '[SILENCIO]');
                return { status: 'ai_silent' };
            }
            // Si no hay texto pero sí se ejecutaron tools, la IA solo actualizó estado (silencio intencional)
            if (!responseText || responseText.trim() === '') {
                logger_1.default.info(`🤫 [IA] Solo ejecutó tools sin respuesta de texto. Silencio intencional.`);
                return { status: 'tools_only_silent' };
            }
            // Guardar en la DB simulada
            await memoryAdapter_1.default.saveMessage(phone, 'model', responseText);
            logger_1.default.info(`[IA - RESPUESTA FINAL]: "${responseText}"`);
            // Timear la respuesta para simular escritura humana
            const targetTypingDuration = Math.min(1000 + responseText.length * 10, 4000);
            const elapsed = Date.now() - typingStartedAt;
            const remainingTypingTime = Math.max(0, targetTypingDuration - elapsed);
            if (remainingTypingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTypingTime));
            }
            // Enviar a WhatsApp!
            await whatsappService_1.default.sendMessage(phone, responseText);
            return { status: 'ai_responded' };
        }
        catch (error) {
            logger_1.default.error(`❌ [ERROR - IA] Error en flujo de IA [${phone}]`, { error: error.message });
            await memoryAdapter_1.default.updateUser(phone, { stage: 'DERIVADO_A_HUMANO' });
            await whatsappService_1.default.sendMessage(phone, "Disculpa, hubo un problema técnico. Te comunicaré con un humano.");
            return { status: 'error', error: error.message };
        }
    }
}
exports.ConversationService = ConversationService;
exports.default = new ConversationService();
