const axios = require('axios');
const config = require('../config');
const { isValidWhatsAppMessage } = require('../utils/validators');
const logger = require('../utils/logger').default;

class WhatsAppService {
  baseUrl: string;
  headers: any;

  constructor() {
    this.baseUrl = `https://graph.facebook.com/v22.0/${config.PHONE_NUMBER_ID}/messages`;
    this.headers = {
      Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Envía un mensaje de texto por WhatsApp
   */
  async sendMessage(to, text) {
    try {
      await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        { headers: this.headers }
      );

      logger.info(`✅ [WHATSAPP API] Mensaje enviado a ${to}: "${text.substring(0, 50)}..."`);
    } catch (error: any) {
      const errorData = error.response?.data;
      logger.error(`❌ [WHATSAPP API - ERROR] No se pudo enviar el mensaje a ${to}.`, {
        message: error.message,
        metaError: errorData,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Marca un mensaje como leído
   */
  async markAsRead(messageId) {
    try {
      await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        },
        { headers: this.headers }
      );
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] Error marcando mensaje como leído (ID: ${messageId})`, {
        error: error.response?.data || error.message,
      });
      // No lanzamos el error para no interrumpir el flujo principal
    }
  }

  /**
   * Extrae el mensaje del webhook de WhatsApp
   */
  extractMessageFromWebhook(body) {
    if (body.object !== 'whatsapp_business_account') {
      return null;
    }

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      return null;
    }

    // Validar que sea un mensaje de texto válido
    if (!isValidWhatsAppMessage(message)) {
      return {
        id: message.id,
        from: message.from,
        type: message.type,
        isText: false,
      };
    }

    return {
      id: message.id,
      from: message.from,
      text: message.text.body,
      type: message.type,
      isText: true,
    };
  }
}

module.exports = new WhatsAppService();
