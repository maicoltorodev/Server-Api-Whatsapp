"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const whatsappService = require('../services/whatsappService');
const conversationService = require('../services/conversationService');
const leadModel = require('../models/leadModel');
const notificationService = require('../services/notificationService');
const rateLimiter = require('../middleware/rateLimit');
const config = require('../config');
const messageQueue = require('../utils/messageQueue');
const logger = require('../utils/logger').default;
class WebhookController {
    /**
     * Maneja el webhook principal de WhatsApp
     */
    async handleWebhook(req, res) {
        const body = req.body;
        res.sendStatus(200);
        try {
            logger.info('--- 📥 NUEVO WEBHOOK DE WHATSAPP ---');
            // 1. Extraer mensaje
            const message = whatsappService.extractMessageFromWebhook(body);
            if (!message) {
                logger.info('Webhook sin mensaje procesable (bloque de estado o lectura).');
                return;
            }
            const { id: msgId, from, text, isText } = message;
            logger.info(`Mensaje Recibido: ID: ${msgId} | Desde: ${from} | ¿Es Texto?: ${isText}`);
            // 2. Seguridad y Duplicados
            if (rateLimiter.isMessageProcessed(msgId)) {
                logger.warn(`Mensaje duplicado detectado (ID: ${msgId}). Ignorando.`);
                return;
            }
            await whatsappService.markAsRead(msgId);
            logger.info(`Mensaje marcado como leído.`);
            // 3. Validación de contenido
            if (!isText) {
                logger.warn('Contenido no es texto. Enviando mensaje de aviso.');
                await whatsappService.sendMessage(from, '¡Hola! 🐾 Por ahora solo puedo procesar mensajes de texto. Si necesitas enviar fotos o audios, pide hablar con un humano.');
                return;
            }
            logger.info(`Texto recibido: "${text}"`);
            // 4. Rate Limiting (Spam)
            if (rateLimiter.isUserSpamming(from)) {
                logger.warn(`SPAM DETECTADO: ${from}.`);
                if (rateLimiter.userMessageCount.get(from).length === config.RATE_LIMIT.MAX_MESSAGES + 1) {
                    await leadModel.deactivateBot(from);
                    await notificationService.notifyOwner(from, 'Alerta Sistema', '🚨 IA desactivada automáticamente por spam detectado.');
                    logger.warn('IA Desactivada preventivamente por spam.');
                }
                return;
            }
            // 5. Delegar a la Cola de Espera (Debounce de 3s)
            logger.info(`Poniendo el mensaje en espera (Embudo Antispam de 3s)...`);
            messageQueue.enqueueMessage(from, text);
        }
        catch (error) {
            logger.error('Error crítico en WebhookController', { error });
            await this.handleCriticalError(req.body, error);
        }
    }
    /**
     * Maneja errores críticos notificando al admin
     */
    async handleCriticalError(body, error) {
        try {
            const fromNumber = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
            if (fromNumber) {
                await notificationService.notifyCriticalError(fromNumber, error.message);
            }
        }
        catch (innerError) {
            logger.error('No se pudo notificar la falla', { error: innerError });
        }
    }
    /**
     * Verificación del webhook (Requerido por Meta en el setup)
     */
    verifyWebhook(req, res) {
        if (req.query['hub.verify_token'] === config.VERIFY_TOKEN) {
            res.send(req.query['hub.challenge']);
        }
        else {
            res.sendStatus(403);
        }
    }
}
module.exports = new WebhookController();
