import { botConfig } from '../config/botConfig';
import { isValidWhatsAppMessage } from '../utils/validators';
import logger from '../utils/logger';

export class WhatsAppService {
  baseUrl: string;
  headers: any;

  constructor() {
    this.baseUrl = `https://graph.facebook.com/v22.0/${botConfig.waPhoneId}/messages`;
    this.headers = {
      Authorization: `Bearer ${botConfig.waToken}`,
      'Content-Type': 'application/json',
    };
  }

  public async sendMessage(to: string, text: string) {
    if (!botConfig.waToken || !botConfig.waPhoneId) {
      logger.warn(`[WHATSAPP API - MOCK] Mensaje a ${to}: "${text}" (Faltan credenciales WA)`);
      return;
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        })
      });

      if (!response.ok) throw new Error(await response.text());
      logger.info(`✅ [WHATSAPP API] Mensaje enviado a ${to}: "${text.substring(0, 50)}..."`);
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] No se pudo enviar el mensaje a ${to}.`, { message: error.message });
    }
  }

  public async markAsRead(messageId: string) {
    if (!botConfig.waToken) return;
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        })
      });
      logger.info(`🔹 [WHATSAPP API] Mensaje ${messageId} marcado como leído.`);
    } catch (e: any) {
      logger.error(`❌ Error marcando como leído: ${e.message}`);
    }
  }

  public extractMessageFromWebhook(body: any) {
    if (body.object !== 'whatsapp_business_account') return null;
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return null;

    if (!isValidWhatsAppMessage(message)) {
      if (['image', 'audio', 'sticker'].includes(message.type)) {
        return {
          id: message.id,
          from: message.from,
          type: message.type,
          isText: false,
          isMedia: true,
          mediaId: message[message.type]?.id,
          mimeType: message[message.type]?.mime_type,
          text: message[message.type]?.caption || ""
        };
      }
      return { id: message.id, from: message.from, type: message.type, isText: false, isMedia: false };
    }

    return {
      id: message.id,
      from: message.from,
      text: message.text.body,
      type: message.type,
      isText: true,
      isMedia: false
    };
  }

  public async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: this.headers });
      if (!response.ok) throw new Error(await response.text());
      const data: any = await response.json();
      return data.url;
    } catch (e) {
      return null;
    }
  }

  public async downloadMedia(url: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) throw new Error(response.statusText);
      return Buffer.from(await response.arrayBuffer());
    } catch (e) {
      return null;
    }
  }

  /**
   * Envía el indicador de "escribiendo..." (Nativo Meta v22.0+)
   */
  public async sendTypingIndicator(to: string, messageId?: string) {
    if (!messageId || !botConfig.waToken) return;
    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
          typing_indicator: { type: 'text' }
        })
      });
      logger.info(`✍️ [WHATSAPP API] Indicador de escritura activo para ${to}`);
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] Fallo al enviar indicador de escritura a ${to}.`, {
        message: error.message
      });
    }
  }
}

export default new WhatsAppService();
