"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const leadModel = require('../models/leadModel');
const chatModel = require('../models/chatModel');
const aiService = require('./aiService');
const whatsappService = require('./whatsappService');
const notificationService = require('./notificationService');
const systemLogModel = require('../models/systemLogModel');
const systemEvents = require('../utils/eventEmitter');
const logger = require('../utils/logger').default;
const types_1 = require("../types");
class ConversationService {
    /**
     * Procesa un mensaje entrante de un cliente de principio a fin
     */
    async handleIncomingMessage(phone, message) {
        logger.info(`🤖 [ORQUESTADOR] Iniciando proceso para el número: ${phone}`);
        // 1. Obtener o crear Lead Raw
        logger.info(`[PASO 1] Verificando perfil del cliente en la Base de Datos...`);
        let rawLead = await leadModel.getByPhone(phone);
        if (!rawLead) {
            logger.info(`  ↳ Cliente nuevo. Creando perfil inicial...`);
            rawLead = await leadModel.upsert({ phone, name: 'Nuevo Cliente', bot_active: true });
        }
        const parsed = types_1.LeadProfileSchema.safeParse(rawLead);
        const leadData = parsed.success ? parsed.data : rawLead;
        logger.info(`  ↳ Perfil listo: ${leadData.name || 'Sin nombre'} | Etapa: ${leadData.current_step}`);
        // 2. Registrar mensaje del cliente
        logger.info(`[PASO 2] Escribiendo el mensaje entrante en el Historial...`);
        await chatModel.addMessage(phone, { role: 'user', parts: [{ text: message }] });
        systemEvents.emit('lead_updated', { phone, type: 'new_message' });
        // 3. Verificar si el bot debe responder
        logger.info(`[PASO 3] Consultando permisos de intervención del Bot...`);
        if (leadData.bot_active === false) {
            logger.info(`  ↳ Bot en PAUSA. Delegando chat al dueño.`);
            return await this.handleHumanIntervention(phone, leadData, message);
        }
        logger.info(`  ↳ Bot ACTIVO. El Agente Inteligente tomará el caso.`);
        // 4. Procesar con IA
        logger.info(`[PASO 4] Despertando motor de Inteligencia Artificial de Gemini...`);
        return await this.processWithAI(phone, message, leadData);
    }
    /**
     * Maneja el flujo cuando un humano tiene el control
     */
    async handleHumanIntervention(phone, leadData, message) {
        logger.warn(`Notificando al dueño que el cliente [${leadData.name || phone}] requiere atención manual.`);
        await notificationService.notifyHumanRequired(phone, leadData.name || 'Cliente', message);
        return { status: 'human_control' };
    }
    /**
     * Orquestación del flujo de IA
     */
    async processWithAI(phone, message, leadData) {
        try {
            // A. Preparar contexto e historial
            logger.info(`[IA - INICIO] Preparando contexto dinámico (catálogo, etapa, resumen) para ${phone}...`);
            const model = await aiService.prepareContext(leadData);
            const history = await chatModel.getHistory(phone);
            logger.info(`Historial cargado: ${history.length} mensajes previos.`);
            // B. Generar respuesta
            logger.info(`[IA - PROCESANDO] Consultando a Gemini para ${phone}...`);
            const aiResponse = await aiService.generateResponse(model, message, history);
            let responseText = '';
            // C. Manejar Function Calls (si existen)
            if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
                logger.info(`La IA solicitó ejecutar herramientas: ${aiResponse.functionCalls.map((c) => c.name).join(', ')}`);
                const result = await aiService.processFunctionCalls(aiResponse.functionCalls, aiResponse.chatSession, phone);
                responseText = result.text;
                logger.info(`Herramientas ejecutadas. Respuesta final de IA obtenida.`);
            }
            else {
                logger.info(`La IA generó una respuesta de texto directa.`);
                responseText = aiResponse.text;
            }
            // Validación de seguridad para evitar enviar mensajes vacíos a WhatsApp
            if (!responseText || responseText.trim() === '') {
                logger.warn(`La IA ejecutó procesos pero no generó texto. Abortando envío silenciosamente para evitar spam al cliente.`);
                systemEvents.emit('lead_updated', { phone, type: 'ai_response' });
                return { status: 'ai_responded_no_text' };
            }
            // D. Persistir respuesta de la IA en el historial (de forma incremental)
            logger.info(`[IA - RESPUESTA FINAL] Respuesta generada para ${phone}: "${responseText}"`);
            logger.info(`Guardando la respuesta de la IA en el historial...`);
            await chatModel.addMessage(phone, { role: 'model', parts: [{ text: responseText }] });
            // E. Enviar al cliente
            logger.info(`[PASO 5] Entregando la respuesta de Miel a WhatsApp...`);
            await whatsappService.sendMessage(phone, responseText);
            logger.info(`  ↳ Mensaje de API enviado a ${phone} exitosamente.`);
            // F. Notificar actualización final
            systemEvents.emit('lead_updated', { phone, type: 'ai_response' });
            logger.info(`Evento 'ai_response' emitido al Dashboard.`);
            return { status: 'ai_responded', text: responseText };
        }
        catch (error) {
            logger.error(`❌ [ERROR - IA] Error en flujo de IA [${phone}]`, { error });
            // Persistimos el error en la base de datos para análisis posterior (Senior approach)
            await systemLogModel.logError(phone, 'Error crítico en flujo processWithAI', {
                context: { message, currentLeadStep: leadData.current_step },
                stack: error.stack,
                message: error.message
            });
            return { status: 'error', error: error.message };
        }
    }
    /**
     * Envía un mensaje manual desde el panel y pausa la IA
     */
    async sendManualMessage(phone, message) {
        // 1. Desactivar Bot para dar control al humano
        await leadModel.deactivateBot(phone);
        // 2. Enviar mensaje vía WhatsApp
        await whatsappService.sendMessage(phone, message);
        // 3. Registrar en historial como una nota del sistema
        await chatModel.addMessage(phone, {
            role: 'model',
            parts: [
                {
                    text: `[NOTA DEL SISTEMA: UN AGENTE HUMANO INTERVINO Y LE ENVIÓ EL SIGUIENTE MENSAJE AL CLIENTE]: "${message}"`,
                },
            ],
        });
        // 4. Notificar actualización
        systemEvents.emit('lead_updated', { phone, type: 'manual_message', bot_active: false });
        return { status: 'success', bot_deactivated: true };
    }
    /**
     * Cambia el estado del Bot (Activar/Desactivar)
     */
    async toggleBot(phone, active) {
        if (active) {
            await leadModel.activateBot(phone);
        }
        else {
            await leadModel.deactivateBot(phone);
        }
        systemEvents.emit('lead_updated', { phone, type: 'bot_toggle', bot_active: active });
        return { status: 'success', bot_active: active };
    }
}
module.exports = new ConversationService();
