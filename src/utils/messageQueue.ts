const conversationService = require('../services/conversationService');
const logger = require('../utils/logger').default;

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

      logger.info(
        `[EMBUDO] Ráfaga activa (${userQueue.messages.length} msgs) para ${from}. Reloj reiniciado a 3s.`
      );

      userQueue.timer = setTimeout(() => this.processMessages(from), this.delayMs);
    } else {
      logger.info(`[EMBUDO] Recibiendo mensaje de ${from}... Esperando 3s por si manda más.`);
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
  async processMessages(from: string) {
    const userQueue = this.queues.get(from);
    if (!userQueue) return;

    // 1. Lo quitamos de la sala de espera
    this.queues.delete(from);

    // 2. Combinamos todo de forma natural (con un '. ' entre párrafos o solo un espacio)
    const combinedText = userQueue.messages.join('. ');

    logger.info(
      `[BLOQUE COMBINADO LISTO] -> Enviando a IA\nUsuario: ${from}\nUnificado (${userQueue.messages.length} envíos en 1): "${combinedText}"`
    );

    // 3. Ahora sí, lo encolamos en el embudo asíncrono seguro (Protegiendo el servidor de ráfagas)
    const concurrencyQueue = require('./ConcurrencyQueue').default;

    concurrencyQueue.enqueue(async () => {
      try {
        await conversationService.handleIncomingMessage(from, combinedText);
      } catch (error: any) {
        logger.error('Error crítico procesando mensaje desde la cola de concurrencia', { error });
      }
    });
  }
}

module.exports = new MessageQueue();
