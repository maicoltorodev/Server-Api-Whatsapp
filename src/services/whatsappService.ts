const axios = require('axios');
const config = require('../config');
const { isValidWhatsAppMessage } = require('../utils/validators');

class WhatsAppService {
  baseUrl: string;
  headers: any;

  constructor() {
    this.baseUrl = `https://graph.facebook.com/v22.0/${config.PHONE_NUMBER_ID}/messages`;
    this.headers = {
      'Authorization': `Bearer ${config.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Envía un mensaje de texto por WhatsApp
   */
  async sendMessage(to, text) {
    try {
      await axios.post(this.baseUrl, {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text }
      }, { headers: this.headers });

      console.log(`✅ Mensaje enviado a ${to}: ${text.substring(0, 50)}...`);
    } catch (error) {
      console.error("Error enviando mensaje WhatsApp:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Marca un mensaje como leído
   */
  async markAsRead(messageId) {
    try {
      await axios.post(this.baseUrl, {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId
      }, {
        headers: { 'Authorization': `Bearer ${config.WHATSAPP_TOKEN}` }
      });
    } catch (error) {
      console.error("Error marcando mensaje como leído:", error.response?.data || error.message);
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
        isText: false
      };
    }

    return {
      id: message.id,
      from: message.from,
      text: message.text.body,
      type: message.type,
      isText: true
    };
  }


  /**
   * Envía SMS al cliente (stub para Twilio/etc)
   */
  async sendSMS(to, text) {
    console.log(`\n---------- ✉️ SMS AUTOMÁTICO AL CLIENTE ----------`);
    console.log(`PARA: ${to}`);
    console.log(`MENSAJE: ${text}`);
    console.log(`--------------------------------------------------\n`);
    return true;
  }
}

module.exports = new WhatsAppService();
