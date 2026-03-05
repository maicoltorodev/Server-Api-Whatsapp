"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const conversationService = require('../services/conversationService');
const logger = require('../utils/logger').default;
class MessageQueue {
    queues;
    processingPhones;
    delayMs;
    constructor() {
        this.queues = new Map();
        this.processingPhones = new Set();
        // Reloj de tolerancia incrementado a 5 segundos para mejor agrupación de ideas
        this.delayMs = 5000;
    }
    /**
     * Encola un mensaje entrante de WhatsApp.
     * Si llegan múltiples mensajes del mismo número antes de que se acabe el reloj,
     * se agrupan en un solo bloque y se reinicia el reloj.
     */
    enqueueMessage(from, text) {
        if (this.queues.has(from)) {
            const userQueue = this.queues.get(from);
            userQueue.messages.push(text);
            clearTimeout(userQueue.timer);
            logger.info(`[EMBUDO] Ráfaga activa (${userQueue.messages.length} msgs) para ${from}. Reloj reiniciado a 5s.`);
            userQueue.timer = setTimeout(() => this.processMessages(from), this.delayMs);
        }
        else {
            logger.info(`[EMBUDO] Recibiendo mensaje de ${from}... Esperando 5s por si manda más.`);
            const timer = setTimeout(() => this.processMessages(from), this.delayMs);
            this.queues.set(from, {
                messages: [text],
                timer: timer,
            });
        }
    }
    /**
     * Cuando el cronómetro muere por inactividad del cliente,
     * junta todos los mensajes de la cola y los dispara de un solo golpe a Gemini.
     */
    async processMessages(from) {
        // Protección de Concurrencia por Usuario: 
        // Si ya hay un proceso de IA corriendo para este teléfono, esperamos para no duplicar.
        if (this.processingPhones.has(from)) {
            logger.warn(`[EMBUDO] El usuario ${from} ya tiene un proceso activo. Re-programando proceso en 1s...`);
            setTimeout(() => this.processMessages(from), 1000);
            return;
        }
        const userQueue = this.queues.get(from);
        if (!userQueue)
            return;
        this.processingPhones.add(from);
        this.queues.delete(from);
        const combinedText = userQueue.messages.join('. ');
        logger.info(`[BLOQUE COMBINADO LISTO] -> Enviando a IA\nUsuario: ${from}\nUnificado (${userQueue.messages.length} envíos en 1): "${combinedText}"`);
        // 3. Ahora sí, lo encolamos en el embudo asíncrono seguro (Protegiendo el servidor de ráfagas)
        const concurrencyQueue = require('./ConcurrencyQueue');
        concurrencyQueue.enqueue(async () => {
            try {
                await conversationService.handleIncomingMessage(from, combinedText);
            }
            catch (error) {
                logger.error('Error crítico procesando mensaje desde la cola de concurrencia', { error });
            }
            finally {
                // Liberar el bloqueo para este teléfono una vez terminada la respuesta
                this.processingPhones.delete(from);
                logger.info(`[EMBUDO] Proceso finalizado para ${from}. Bloqueo liberado.`);
            }
        });
    }
}
module.exports = new MessageQueue();
