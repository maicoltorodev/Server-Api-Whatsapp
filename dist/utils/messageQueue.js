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
exports.MessageQueue = void 0;
const conversationService_1 = __importDefault(require("../services/conversationService"));
const logger_1 = __importStar(require("../utils/logger"));
const ConcurrencyQueue_1 = __importDefault(require("./ConcurrencyQueue"));
class MessageQueue {
    queues;
    processingPhones;
    delayMs;
    constructor() {
        this.queues = new Map();
        this.processingPhones = new Set();
        // Reloj de tolerancia reducido a 3 segundos para una respuesta más ágil
        this.delayMs = 3000;
    }
    /**
     * Encola un mensaje entrante de WhatsApp.
     * Si llegan múltiples mensajes del mismo número antes de que se acabe el reloj,
     * se agrupan en un solo bloque y se reinicia el reloj.
     */
    enqueueMessage(from, content, lastMsgId, startTime) {
        if (this.queues.has(from)) {
            const userQueue = this.queues.get(from);
            userQueue.contents.push(content);
            if (lastMsgId)
                userQueue.lastMsgId = lastMsgId;
            // Mantenemos el startTime original del primer mensaje de la ráfaga
            clearTimeout(userQueue.timer);
            /* logger.info(
              `[EMBUDO] Ráfaga activa (${userQueue.contents.length} msgs) para ${from}. Reloj reiniciado a 5s.`
            ); */
            userQueue.timer = setTimeout(() => this.processMessages(from), this.delayMs);
        }
        else {
            // logger.info(`[EMBUDO] Recibiendo mensaje de ${from}... Esperando 5s por si manda más.`);
            const timer = setTimeout(() => this.processMessages(from), this.delayMs);
            const context = logger_1.correlationContext.getStore();
            this.queues.set(from, {
                contents: [content],
                timer: timer,
                lastMsgId: lastMsgId,
                startTime: startTime || Date.now(),
                correlationId: context?.id
            });
        }
    }
    /**
     * Cuando el cronómetro muere por inactividad del cliente,
     * junta todos los mensajes de la cola y los dispara de un solo golpe a Gemini.
     */
    async processMessages(from) {
        if (this.processingPhones.has(from)) {
            logger_1.default.warn(`[EMBUDO] El usuario ${from} ya tiene un proceso activo. Re-programando proceso en 1s...`);
            setTimeout(() => this.processMessages(from), 1000);
            return;
        }
        const userQueue = this.queues.get(from);
        if (!userQueue)
            return;
        this.processingPhones.add(from);
        const { contents, lastMsgId, startTime, correlationId } = userQueue;
        this.queues.delete(from);
        return await logger_1.correlationContext.run({ id: correlationId || 'auto' }, async () => {
            // Combinar textos y recolectar media
            const texts = [];
            const mediaItems = [];
            contents.forEach((c) => {
                if (c.text)
                    texts.push(c.text);
                if (c.media)
                    mediaItems.push(c.media);
            });
            const combinedText = texts.join('. ');
            logger_1.default.info(`[BLOQUE COMBINADO LISTO] -> Enviando a IA\nUsuario: ${from}\nUnificado (${contents.length} envíos en 1): "${combinedText}" | Media count: ${mediaItems.length}`);
            ConcurrencyQueue_1.default.enqueue(async () => {
                return await logger_1.correlationContext.run({ id: correlationId || 'auto' }, async () => {
                    try {
                        await conversationService_1.default.handleIncomingMessage(from, combinedText, mediaItems, lastMsgId);
                    }
                    catch (error) {
                        logger_1.default.error('Error crítico procesando mensaje desde la cola de concurrencia', { error });
                    }
                    finally {
                        this.processingPhones.delete(from);
                        // logger.info(`[EMBUDO] Proceso finalizado para ${from}. Bloqueo liberado.`);
                    }
                });
            });
        });
    }
}
exports.MessageQueue = MessageQueue;
exports.default = new MessageQueue();
