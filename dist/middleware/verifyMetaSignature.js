"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyMetaSignature = verifyMetaSignature;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../utils/logger"));
function verifyMetaSignature(req, res, next) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        logger_1.default.warn('Webhook security alert', { reason: 'missing_signature' });
        return res.sendStatus(403);
    }
    const elements = signature.split('=');
    if (elements.length !== 2 || elements[0] !== 'sha256') {
        return res.sendStatus(403);
    }
    const signatureHash = elements[1];
    // Asumimos un App Secret genérico o configurado en entorno
    const appSecret = process.env.META_APP_SECRET || 'secret';
    const expectedHash = crypto_1.default
        .createHmac('sha256', appSecret)
        .update(req.rawBody)
        .digest('hex');
    try {
        const signatureBuffer = Buffer.from(signatureHash, 'hex');
        const expectedBuffer = Buffer.from(expectedHash, 'hex');
        if (signatureBuffer.length !== expectedBuffer.length ||
            !crypto_1.default.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            logger_1.default.error('FIRMA INVÁLIDA DETECTADA: Spoofing detenido.');
            return res.sendStatus(403);
        }
    }
    catch (error) {
        return res.sendStatus(403);
    }
    next();
}
exports.default = verifyMetaSignature;
