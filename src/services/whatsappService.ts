import config from '../config';
import { isValidWhatsAppMessage } from '../utils/validators';
import logger from '../utils/logger';

export class WhatsAppService {
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
  public async sendMessage(to: string, text: string) {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      logger.info(`✅ [WHATSAPP API] Mensaje enviado a ${to}: "${text.substring(0, 50)}..."`);
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] No se pudo enviar el mensaje a ${to}.`, {
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Obtiene la URL de descarga de un archivo multimedia desde Meta
   */
  public async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
        headers: this.headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
      }

      const data: any = await response.json();
      return data.url;
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] No se pudo obtener la URL del media ${mediaId}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Descarga un archivo multimedia y lo retorna como Buffer
   */
  public async downloadMedia(url: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Error descargando media: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] Fallo al descargar el archivo: ${url}`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Marca un mensaje como leído con un pequeño retraso para evitar errores de sincronización de Meta
   */
  public async markAsRead(messageId: string) {
    try {
      // Pequeño retraso de 1s para asegurar que Meta haya registrado el ID (especialmente útil en multimedia)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        })
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        // Si el error es que el ID no existe, lo tratamos como advertencia, no como error crítico
        if (errorData.error?.code === 100 || errorData.error?.message?.includes("does not exist")) {
          logger.warn(`⚠️ [WHATSAPP API] No se pudo marcar como leído: El ID ${messageId} todavía no es reconocido por Meta (Sincronización).`);
          return;
        }
        throw new Error(JSON.stringify(errorData));
      }

      logger.info(`🔹 [WHATSAPP API] Mensaje ${messageId} marcado como leído.`);
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] Error inesperado marcando mensaje como leído (ID: ${messageId})`, {
        error: error.message,
      });
    }
  }

  /**
   * Envía el indicador de "escribiendo..." (Sender Action)
   */
  public async sendTypingIndicator(to: string) {
    try {
      // Nota: Oficialmente WhatsApp usa 'typing' para mostrar el estado en el chat.
      // Algunas versiones/librerías lo llaman 'sender_action' o 'typing'
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          sender_action: 'typing'
        })
      });
      logger.info(`✍️ [WHATSAPP API] Indicador de escritura enviado a ${to}`);
    } catch (error: any) {
      logger.error(`❌ [WHATSAPP API - ERROR] No se pudo enviar el indicador de escritura a ${to}.`, {
        message: error.message
      });
    }
  }

  /**
   * Extrae el mensaje del webhook de WhatsApp
   */
  public extractMessageFromWebhook(body: any) {
    if (body.object !== 'whatsapp_business_account') {
      return null;
    }

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) {
      return null;
    }

    // Validar que sea un mensaje de texto válido
    if (!isValidWhatsAppMessage(message)) {
      // Si es imagen o audio, los procesamos de forma especial
      if (message.type === 'image' || message.type === 'audio') {
        const mediaId = message.image?.id || message.audio?.id;
        const mimeType = message.image?.mime_type || message.audio?.mime_type;
        const caption = message.image?.caption || "";

        return {
          id: message.id,
          from: message.from,
          type: message.type,
          isText: false,
          isMedia: true,
          mediaId,
          mimeType,
          text: caption // Las imágenes a veces tienen pies de foto
        };
      }

      return {
        id: message.id,
        from: message.from,
        type: message.type,
        isText: false,
        isMedia: false
      };
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
}

export default new WhatsAppService();

