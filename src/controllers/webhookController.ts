import { Request, Response } from 'express';
import whatsappService from '../services/whatsappService';
import conversationService from '../services/conversationService';
import leadModel from '../models/leadModel';
import notificationService from '../services/notificationService';
import rateLimiter from '../middleware/rateLimit';
import config from '../config';
import messageQueue from '../utils/messageQueue';
import logger from '../utils/logger';

export class WebhookController {
  /**
   * Maneja el webhook principal de WhatsApp
   */
  public async handleWebhook(req: Request, res: Response) {
    const body = req.body;
    res.sendStatus(200);

    try {
      // 1. Extraer mensaje de los metadatos
      const message = whatsappService.extractMessageFromWebhook(body);
      if (!message) {
        // Ignoramos silenciosamente notificaciones de lectura o estado
        return;
      }

      logger.info('🟢 [WEBHOOK] --- NUEVO MENSAJE DE WHATSAPP DETECTADO ---');

      const { id: msgId, from, text, isText } = message as any;
      logger.info(`🔵 [MENSAJE NUEVO] Mensaje Recibido: ID: ${msgId} | Desde: ${from} | ¿Es Texto?: ${isText}`);

      // 2. Seguridad y Duplicados
      if (rateLimiter.isMessageProcessed(msgId)) {
        logger.warn(`Mensaje duplicado detectado (ID: ${msgId}). Ignorando.`);
        return;
      }
      await whatsappService.markAsRead(msgId);
      logger.info(`Mensaje marcado como leído.`);

      // 3. Procesar Contenido (Media o Texto)
      if (!isText) {
        if (message.isMedia && message.mediaId) {
          logger.info(`📸 [MEDIA DETECTADO] Descargando ${message.type} de ${from}...`);

          const mediaUrl = await whatsappService.getMediaUrl(message.mediaId);
          if (mediaUrl) {
            const buffer = await whatsappService.downloadMedia(mediaUrl);
            if (buffer) {
              const base64Media = buffer.toString('base64');
              const mediaContent = {
                text: message.text || (message.type === 'audio' ? '[AUDIO]' : (message.type === 'sticker' ? '[STICKER]' : '[IMAGEN]')),
                media: {
                  data: base64Media,
                  mimeType: message.mimeType
                }
              };

              logger.info(`Poniendo MEDIA en la cola (ID: ${message.mediaId})...`);
              messageQueue.enqueueMessage(from, mediaContent);
              return;
            }
          }
        }

        logger.warn(`[WEBHOOK] Contenido no soportado (Tipo: ${message.type}) recibido de ${from}. IGNORANDO silenciosamente según reglas de negocio.`);
        return;
      }

      logger.info(`🔵 [MENSAJE NUEVO DETALLE] "${text}" de "${from}"`);
      messageQueue.enqueueMessage(from, { text });
    } catch (error: any) {
      logger.error('Error crítico en WebhookController', { error });
      await this.handleCriticalError(req.body, error);
    }
  }

  /**
   * Maneja errores críticos notificando al admin
   */
  public async handleCriticalError(body: any, error: any) {
    try {
      const fromNumber = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      if (fromNumber) {
        await notificationService.notifyCriticalError(fromNumber, error.message);
      }
    } catch (innerError) {
      logger.error('No se pudo notificar la falla', { error: innerError });
    }
  }

  /**
   * Verificación del webhook (Requerido por Meta en el setup)
   */
  public verifyWebhook(req: Request, res: Response) {
    if (req.query['hub.verify_token'] === config.VERIFY_TOKEN) {
      res.send(req.query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
  }
}

export default new WebhookController();
