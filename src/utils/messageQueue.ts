const conversationService = require('../services/conversationService');

class MessageQueue {
    queues: Map<string, any>;
    delayMs: number;

    constructor() {
        this.queues = new Map();
        // Reloj de tolerancia: 3 segundos (3000 ms)
        this.delayMs = 3000;
    }

    /**
     * Encola un mensaje entrante de WhatsApp.
     * Si llegan múltiples mensajes del mismo número antes de que se acabe el reloj, 
     * se agrupan en un solo bloque y se reinicia el reloj.
     * 
     * @param from Teléfono del remitente
     * @param text Texto del último mensaje
     */
    enqueueMessage(from: string, text: string) {
        if (this.queues.has(from)) {
            const userQueue = this.queues.get(from);
            userQueue.messages.push(text);
            clearTimeout(userQueue.timer);

            console.log(`⏱️ [EMBUDO] Ráfaga activa (${userQueue.messages.length} msgs) para ${from}. Reloj reiniciado a 3s.`);

            userQueue.timer = setTimeout(() => this.processMessages(from), this.delayMs);
        } else {
            console.log(`⏱️ [EMBUDO] Recibiendo mensaje de ${from}... Esperando 3s por si manda más.`);
            const timer = setTimeout(() => this.processMessages(from), this.delayMs);
            this.queues.set(from, {
                messages: [text],
                timer: timer
            });
        }
    }

    /**
     * Cuando el cronómetro muere por inactividad del cliente, 
     * junta todos los mensajes de la cola y los dispara de un solo golpe a Gemini.
     */
    async processMessages(from: string) {
        const userQueue = this.queues.get(from);
        if (!userQueue) return;

        // 1. Lo quitamos de la sala de espera
        this.queues.delete(from);

        // 2. Combinamos todo de forma natural (con un '. ' entre párrafos o solo un espacio)
        const combinedText = userQueue.messages.join('. ');

        console.log(`\n=================================================`);
        console.log(`🚀 [BLOQUE COMBINADO LISTO] -> Enviando a IA`);
        console.log(`👤 Usuario: ${from}`);
        console.log(`📦 Unificado (${userQueue.messages.length} envíos en 1): "${combinedText}"`);
        console.log(`=================================================\n`);

        // 3. Ahora sí, le entregamos la conversación al Orquestador de la IA (Ahorramos Tokens)
        try {
            await conversationService.handleIncomingMessage(from, combinedText);
        } catch (error: any) {
            console.error("🔥 Error procesando ráfaga combinada:", error.message);
        }
    }
}

module.exports = new MessageQueue();
