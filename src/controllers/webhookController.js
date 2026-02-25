const whatsappService = require('../services/whatsappService');
const aiService = require('../services/aiService');
const leadModel = require('../models/leadModel');
const chatModel = require('../models/chatModel');
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
      // Extraer mensaje del webhook
      const message = whatsappService.extractMessageFromWebhook(body);
      if (!message) return;

      const { id: msgId, from, text, isText } = message;

      // Prevenir duplicados
      if (rateLimiter.isMessageProcessed(msgId)) return;

      // Marcar mensaje como leído
      await whatsappService.markAsRead(msgId);

      // Si no es mensaje de texto, responder con mensaje predefinido
      if (!isText) {
        await whatsappService.sendMessage(
          from,
          "¡Hola! 🐾 Como soy el asistente virtual, por ahora solo puedo leer mensajes de texto. ¿Podrías escribirme tu consulta? O si prefieres, pide hablar con un humano y te conectaré."
        );
        return;
      }

      // Verificar spam
      if (rateLimiter.isUserSpamming(from)) {
        if (rateLimiter.userMessageCount.get(from).length === config.RATE_LIMIT.MAX_MESSAGES + 1) {
          await leadModel.deactivateBot(from);
          await notificationService.notifyOwner(
            from,
            "Alerta Sistema",
            "🚨 La IA se auto-desactivó para este número por comportamiento abusivo (>10 msgs en 30s)."
          );
        }
        return;
      }

      // Manejar mensaje de cliente de forma unificada
      await this.handleClientMessage(from, text);

    } catch (error) {
      console.error("🔥 Error fatal en el Webhook:", error.message);
      await this.handleCriticalError(req.body, error);
    }
  }

  /**
   * Maneja mensajes de clientes
   */
  async handleClientMessage(clientPhone, message) {
    console.log(`\n--- 📥 MENSAJE CLIENTE: ${clientPhone} ---`);

    // Obtener información del lead
    const leadData = await leadModel.getByPhone(clientPhone);

    // Verificar si el bot está desactivado
    if (leadData && leadData.bot_active === false) {
      await this.handleInactiveBot(clientPhone, leadData, message);
      return;
    }

    // Procesamiento normal con IA
    await this.processWithAI(clientPhone, message, leadData);
  }

  /**
   * Maneja cuando el bot está inactivo
   */
  async handleInactiveBot(clientPhone, leadData, message) {
    // Modo "Standalone": Si el bot está apagado, solo registramos en BD/Logs pero la IA no responde.
    // En la próxima fase, un Dashboard WebSocket notificará en vivo al personal humano.
    console.log(`⚠️ Bot pausado. Cliente [${leadData.name || clientPhone}] escribió: ${message}`);
    // Opcional: Notificar al sistema central
    await notificationService.notifyHumanRequired(clientPhone, leadData.name || "Cliente", message);
  }

  /**
   * Procesa mensaje con IA
   */
  async processWithAI(phone, message, leadData) {
    try {
      // Preparar contexto para la IA
      const context = await aiService.prepareContext(leadData);

      // Obtener historial de chat
      const history = await chatModel.getHistory(phone);

      // Generar respuesta de la IA
      const aiResponse = await aiService.generateResponse(message, history);

      let responseText = "";

      // Procesar function calls si existen
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        const call = aiResponse.functionCalls[0];
        const result = await aiService.processFunctionCall(call, aiResponse.chatSession, phone, leadData);
        responseText = result.text;
      } else {
        responseText = aiResponse.text;
      }

      // Guardar historial actualizado
      const newHistory = await aiResponse.chatSession.getHistory();
      await chatModel.saveHistory(phone, newHistory);

      // Enviar respuesta
      await whatsappService.sendMessage(phone, responseText);
      console.log(`✅ Respuesta enviada.`);

    } catch (error) {
      console.error("Error procesando con IA:", error);
      await whatsappService.sendMessage(
        phone,
        "Disculpa, tuve un problema procesando tu mensaje. Por favor, intenta de nuevo en unos momentos."
      );
    }
  }

  /**
   * Maneja errores críticos
   */
  async handleCriticalError(body, error) {
    try {
      const fromNumber = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      if (fromNumber) {
        await notificationService.notifyCriticalError(fromNumber, error.message);
        await notificationService.notifyClientError(fromNumber);
      }
    } catch (innerError) {
      console.error("No se pudo notificar la falla:", innerError.message);
    }
  }

  /**
   * Verificación del webhook (para Meta)
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
