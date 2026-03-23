"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const botConfig_1 = require("../config/botConfig");
const validators_1 = require("../utils/validators");
const logger_1 = __importDefault(require("../utils/logger"));
class WhatsAppService {
    baseUrl;
    headers;
    constructor() {
        this.baseUrl = `https://graph.facebook.com/v22.0/${botConfig_1.botConfig.waPhoneId}/messages`;
        this.headers = {
            Authorization: `Bearer ${botConfig_1.botConfig.waToken}`,
            'Content-Type': 'application/json',
        };
    }
    async sendMessage(to, text) {
        if (!botConfig_1.botConfig.waToken || !botConfig_1.botConfig.waPhoneId) {
            logger_1.default.warn(`[WHATSAPP API - MOCK] Mensaje a ${to}: "${text}" (Faltan credenciales WA)`);
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
            if (!response.ok)
                throw new Error(await response.text());
            logger_1.default.info(`✅ [WHATSAPP API] Mensaje enviado a ${to}: "${text.substring(0, 50)}..."`);
        }
        catch (error) {
            logger_1.default.error(`❌ [WHATSAPP API - ERROR] No se pudo enviar el mensaje a ${to}.`, { message: error.message });
        }
    }
    async markAsRead(messageId) {
        if (!botConfig_1.botConfig.waToken)
            return;
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
            logger_1.default.info(`🔹 [WHATSAPP API] Mensaje ${messageId} marcado como leído.`);
        }
        catch (e) {
            logger_1.default.error(`❌ Error marcando como leído: ${e.message}`);
        }
    }
    extractMessageFromWebhook(body) {
        if (body.object !== 'whatsapp_business_account')
            return null;
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (!message)
            return null;
        if (!(0, validators_1.isValidWhatsAppMessage)(message)) {
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
    async getMediaUrl(mediaId) {
        try {
            const response = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: this.headers });
            if (!response.ok)
                throw new Error(await response.text());
            const data = await response.json();
            return data.url;
        }
        catch (e) {
            return null;
        }
    }
    async downloadMedia(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            if (!response.ok)
                throw new Error(response.statusText);
            return Buffer.from(await response.arrayBuffer());
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Envía el indicador de "escribiendo..." (Nativo Meta v22.0+)
     */
    async sendTypingIndicator(to, messageId) {
        if (!messageId || !botConfig_1.botConfig.waToken)
            return;
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
            logger_1.default.info(`✍️ [WHATSAPP API] Indicador de escritura activo para ${to}`);
        }
        catch (error) {
            logger_1.default.error(`❌ [WHATSAPP API - ERROR] Fallo al enviar indicador de escritura a ${to}.`, {
                message: error.message
            });
        }
    }
}
exports.WhatsAppService = WhatsAppService;
exports.default = new WhatsAppService();
