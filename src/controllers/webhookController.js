const whatsappService = require('../services/whatsappService');
const conversationService = require('../services/conversationService');
const leadModel = require('../models/leadModel');
const notificationService = require('../services/notificationService');
const rateLimiter = require('../middleware/rateLimit');
const config = require('../config');

class WebhookController {
  /**
   * Maneja el webhook principal de WhatsApp
   */
  async handleWebhook(req, res) {
    const body = req.body;
    res.sendStatus(200);

    try {
      console.log("\n--- 📥 NUEVO WEBHOOK DE WHATSAPP ---");
      // 1. Extraer mensaje
      const message = whatsappService.extractMessageFromWebhook(body);
      if (!message) {
        console.log("ℹ️ Webhook sin mensaje procesable (bloque de estado o lectura).");
        return;
      }

      const { id: msgId, from, text, isText } = message;
      console.log(`📍 Mensaje Recibido: ID: ${msgId} | Desde: ${from} | ¿Es Texto?: ${isText}`);

      // 2. Seguridad y Duplicados
      if (rateLimiter.isMessageProcessed(msgId)) {
        console.log(`⛔ Mensaje duplicado detectado (ID: ${msgId}). Ignorando.`);
        return;
      }
      await whatsappService.markAsRead(msgId);
      console.log(`✅ Mensaje marcado como leído.`);

      // 3. Validación de contenido
      if (!isText) {
        console.log("⚠️ Contenido no es texto. Enviando mensaje de aviso.");
        await whatsappService.sendMessage(
          from,
          "¡Hola! 🐾 Por ahora solo puedo procesar mensajes de texto. Si necesitas enviar fotos o audios, pide hablar con un humano."
        );
        return;
      }

      console.log(`📝 Texto recibido: "${text}"`);

      // 4. Rate Limiting (Spam)
      if (rateLimiter.isUserSpamming(from)) {
        console.log(`🚨 SPAM DETECTADO: ${from}.`);
        if (rateLimiter.userMessageCount.get(from).length === config.RATE_LIMIT.MAX_MESSAGES + 1) {
          await leadModel.deactivateBot(from);
          await notificationService.notifyOwner(
            from,
            "Alerta Sistema",
            "🚨 IA desactivada automáticamente por spam detectado."
          );
          console.log("🤖 IA Desactivada preventivamente por spam.");
        }
        return;
      }

      // 5. Delegar el resto a ConversationService
      console.log(`➡️ Delegando conversación a ConversationService...`);
      await conversationService.handleIncomingMessage(from, text);

    } catch (error) {
      console.error("🔥 Error crítico en WebhookController:", error.message);
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
    } catch (innerError) {
      console.error("No se pudo notificar la falla:", innerError.message);
    }
  }

  /**
   * Verificación del webhook (Requerido por Meta en el setup)
   */
  verifyWebhook(req, res) {
    if (req.query['hub.verify_token'] === config.VERIFY_TOKEN) {
      res.send(req.query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
  }
}

module.exports = new WebhookController();
