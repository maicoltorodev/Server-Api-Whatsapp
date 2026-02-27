const crypto = require('crypto');
const config = require('../config');

/**
 * Middleware para verificar la firma de Meta para seguridad del webhook
 */
function verifyMetaSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.warn("🚫 Intento de acceso sin firma al Webhook.");
    return res.sendStatus(403);
  }

  const elements = signature.split('=');
  const signatureHash = elements[1];

  // Calcula el hash con tu APP SECRET de Meta
  const expectedHash = crypto
    .createHmac('sha256', config.META_APP_SECRET)
    .update(req.rawBody)
    .digest('hex');

  if (signatureHash !== expectedHash) {
    console.error("☠️ FIRMA INVÁLIDA DETECTADA: Spoofing detenido.");
    return res.sendStatus(403);
  }
  next();
}

module.exports = {
  verifyMetaSignature
};
