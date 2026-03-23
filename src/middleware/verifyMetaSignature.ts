import crypto from 'crypto';
import { botConfig } from '../config/botConfig';
import logger from '../utils/logger';
import { Request, Response, NextFunction } from 'express';

export function verifyMetaSignature(req: any, res: Response, next: NextFunction) {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    logger.warn('Webhook security alert', { reason: 'missing_signature' });
    return res.sendStatus(403);
  }

  const elements = signature.split('=');
  if (elements.length !== 2 || elements[0] !== 'sha256') {
    return res.sendStatus(403);
  }

  const signatureHash = elements[1];
  
  // Asumimos un App Secret genérico o configurado en entorno
  const appSecret = process.env.META_APP_SECRET || 'secret';

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  try {
    const signatureBuffer = Buffer.from(signatureHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      logger.error('FIRMA INVÁLIDA DETECTADA: Spoofing detenido.');
      return res.sendStatus(403);
    }
  } catch (error: any) {
    return res.sendStatus(403);
  }

  next();
}

export default verifyMetaSignature;
