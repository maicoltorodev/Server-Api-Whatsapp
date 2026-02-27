const crypto = require('crypto');
const config = require('../config');

/**
 * Middleware para verificar la firma de Meta para seguridad del webhook.
 * Implementa validación estricta usando timingSafeEqual y logs estructurados.
 */
function verifyMetaSignature(req, res, next) {
    const signature = req.headers['x-hub-signature-256'];

    // 1. Validar presencia de la firma
    if (!signature) {
        console.warn(JSON.stringify({
            event: "webhook_security_alert",
            reason: "missing_signature",
            ip: req.ip || req.connection?.remoteAddress,
            timestamp: new Date().toISOString()
        }));
        return res.sendStatus(403);
    }

    // 2. Validar formato de la firma (sha256=...)
    const elements = signature.split('=');
    if (elements.length !== 2 || elements[0] !== 'sha256') {
        console.warn(JSON.stringify({
            event: "webhook_security_alert",
            reason: "invalid_signature_format",
            signature_received: signature,
            ip: req.ip || req.connection?.remoteAddress,
            timestamp: new Date().toISOString()
        }));
        return res.sendStatus(403);
    }

    const signatureHash = elements[1];

    if (!config.META_APP_SECRET || config.META_APP_SECRET === 'placeholder_secret_para_dev') {
        console.warn("⚠️ ALERTA DE SEGURIDAD: META_APP_SECRET no está configurado correctamente para producción. La validación podría ser inefectiva.");
    }

    // 3. Calcular el hash con el APP SECRET de Meta
    const expectedHash = crypto
        .createHmac('sha256', config.META_APP_SECRET)
        .update(req.rawBody)
        .digest('hex');

    // 4. Validación estricta en tiempo constante (timingSafeEqual)
    try {
        const signatureBuffer = Buffer.from(signatureHash, 'hex');
        const expectedBuffer = Buffer.from(expectedHash, 'hex');

        // Revisar si las longitudes coinciden para evitar un error en timingSafeEqual
        if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            console.error(JSON.stringify({
                event: "webhook_security_alert",
                reason: "signature_mismatch",
                message: "☠️ FIRMA INVÁLIDA DETECTADA: Spoofing detenido.",
                expected_hash: expectedHash,
                received_hash: signatureHash,
                ip: req.ip || req.connection?.remoteAddress,
                timestamp: new Date().toISOString()
            }));
            return res.sendStatus(403);
        }
    } catch (error) {
        // En caso de que la firma recibida no sea un hex válido y cause un fallo al convertir a buffer
        console.error(JSON.stringify({
            event: "webhook_security_alert",
            reason: "signature_processing_error",
            error: error.message,
            ip: req.ip || req.connection?.remoteAddress,
            timestamp: new Date().toISOString()
        }));
        return res.sendStatus(403);
    }

    // Todo correcto, permitimos que el request continúe
    next();
}

module.exports = verifyMetaSignature;
