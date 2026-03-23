import { Request, Response } from 'express';
import whatsappService from '../services/whatsappService';
import { botConfig } from '../config/botConfig';
import messageQueue from '../utils/messageQueue';
import logger, { correlationContext } from '../utils/logger';

export class WebhookController {
  
  public async handleWebhook(req: Request, res: Response) {
    const body = req.body;
    // Responder inmediatamente a WhatsApp (Regla de Meta: Responder 200 en < 3 segs)
    res.sendStatus(200);

    try {
      const startTime = Date.now();
      const message = whatsappService.extractMessageFromWebhook(body);
      
      if (!message) return;

      const { id: msgId, from, text, isText } = message as any;
      const correlationId = msgId.slice(-4);

      return await correlationContext.run({ id: correlationId }, async () => {
        
        // Marcamos como leído
        await whatsappService.markAsRead(msgId);

        // Si es Media (Imagen, Audio)
        if (!isText) {
          if (message.isMedia && message.mediaId) {
            logger.info(`📸 [MEDIA DETECTADO] Descargando ${message.type} de ${from}...`);

            const mediaUrl = await whatsappService.getMediaUrl(message.mediaId);
            if (mediaUrl) {
              const buffer = await whatsappService.downloadMedia(mediaUrl);
              if (buffer) {
                const base64Media = buffer.toString('base64');
                const mediaContent = {
                  text: message.text || `[${message.type.toUpperCase()}]`,
                  media: { data: base64Media, mimeType: message.mimeType }
                };

                messageQueue.enqueueMessage(from, mediaContent, message.id, startTime);
                return;
              }
            }
          }
          logger.warn(`[WEBHOOK] Contenido no soportado de ${from}. Ignorando.`);
          return;
        }

        // Si es Texto normal, encolamos para soportar ráfagas (cliente manda varios msgs cortos seguidos)
        messageQueue.enqueueMessage(from, { text }, msgId, startTime);
      });
    } catch (error: any) {
      logger.error('Error crítico en WebhookController', { error: error.message });
    }
  }

  /**
   * Challenge de Verificación de Meta al configurar Webhook
   */
  public verifyWebhook(req: Request, res: Response) {
    if (req.query['hub.verify_token'] === botConfig.waVerifyToken) {
      res.send(req.query['hub.challenge']);
    } else {
      res.sendStatus(403);
    }
  }
}

export default new WebhookController();
