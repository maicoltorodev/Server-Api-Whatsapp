"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const whatsappService_1 = __importDefault(require("../services/whatsappService"));
const botConfig_1 = require("../config/botConfig");
const messageQueue_1 = __importDefault(require("../utils/messageQueue"));
const logger_1 = __importStar(require("../utils/logger"));
class WebhookController {
    async handleWebhook(req, res) {
        const body = req.body;
        // Responder inmediatamente a WhatsApp (Regla de Meta: Responder 200 en < 3 segs)
        res.sendStatus(200);
        try {
            const startTime = Date.now();
            const message = whatsappService_1.default.extractMessageFromWebhook(body);
            if (!message)
                return;
            const { id: msgId, from, text, isText } = message;
            const correlationId = msgId.slice(-4);
            return await logger_1.correlationContext.run({ id: correlationId }, async () => {
                // Marcamos como leído
                await whatsappService_1.default.markAsRead(msgId);
                // Si es Media (Imagen, Audio)
                if (!isText) {
                    if (message.isMedia && message.mediaId) {
                        logger_1.default.info(`📸 [MEDIA DETECTADO] Descargando ${message.type} de ${from}...`);
                        const mediaUrl = await whatsappService_1.default.getMediaUrl(message.mediaId);
                        if (mediaUrl) {
                            const buffer = await whatsappService_1.default.downloadMedia(mediaUrl);
                            if (buffer) {
                                const base64Media = buffer.toString('base64');
                                const mediaContent = {
                                    text: message.text || `[${message.type.toUpperCase()}]`,
                                    media: { data: base64Media, mimeType: message.mimeType }
                                };
                                messageQueue_1.default.enqueueMessage(from, mediaContent, message.id, startTime);
                                return;
                            }
                        }
                    }
                    logger_1.default.warn(`[WEBHOOK] Contenido no soportado de ${from}. Ignorando.`);
                    return;
                }
                // Si es Texto normal, encolamos para soportar ráfagas (cliente manda varios msgs cortos seguidos)
                messageQueue_1.default.enqueueMessage(from, { text }, msgId, startTime);
            });
        }
        catch (error) {
            logger_1.default.error('Error crítico en WebhookController', { error: error.message });
        }
    }
    /**
     * Challenge de Verificación de Meta al configurar Webhook
     */
    verifyWebhook(req, res) {
        if (req.query['hub.verify_token'] === botConfig_1.botConfig.waVerifyToken) {
            res.send(req.query['hub.challenge']);
        }
        else {
            res.sendStatus(403);
        }
    }
}
exports.WebhookController = WebhookController;
exports.default = new WebhookController();
