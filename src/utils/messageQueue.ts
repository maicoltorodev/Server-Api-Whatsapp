import conversationService from '../services/conversationService';
import logger from '../utils/logger';
import concurrencyQueue from './ConcurrencyQueue';

export class MessageQueue {
  private queues: Map<string, any>;
  private processingPhones: Set<string>;
  private delayMs: number;

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
  public enqueueMessage(from: string, content: { text?: string; media?: { data: string; mimeType: string } }) {
    if (this.queues.has(from)) {
      const userQueue = this.queues.get(from);
      userQueue.contents.push(content);
      clearTimeout(userQueue.timer);

      logger.info(
        `[EMBUDO] Ráfaga activa (${userQueue.contents.length} msgs) para ${from}. Reloj reiniciado a 5s.`
      );

      userQueue.timer = setTimeout(() => this.processMessages(from), this.delayMs);
    } else {
      logger.info(`[EMBUDO] Recibiendo mensaje de ${from}... Esperando 5s por si manda más.`);
      const timer = setTimeout(() => this.processMessages(from), this.delayMs);
      this.queues.set(from, {
        contents: [content],
        timer: timer,
      });
    }
  }

  /**
   * Cuando el cronómetro muere por inactividad del cliente,
   * junta todos los mensajes de la cola y los dispara de un solo golpe a Gemini.
   */
  private async processMessages(from: string) {
    if (this.processingPhones.has(from)) {
      logger.warn(`[EMBUDO] El usuario ${from} ya tiene un proceso activo. Re-programando proceso en 1s...`);
      setTimeout(() => this.processMessages(from), 1000);
      return;
    }

    const userQueue = this.queues.get(from);
    if (!userQueue) return;

    this.processingPhones.add(from);
    this.queues.delete(from);

    // Combinar textos y recolectar media
    const texts: string[] = [];
    const mediaItems: any[] = [];

    userQueue.contents.forEach((c: any) => {
      if (c.text) texts.push(c.text);
      if (c.media) mediaItems.push(c.media);
    });

    const combinedText = texts.join('. ');

    logger.info(
      `[BLOQUE COMBINADO LISTO] -> Enviando a IA\nUsuario: ${from}\nUnificado (${userQueue.contents.length} envíos en 1): "${combinedText}" | Media count: ${mediaItems.length}`
    );

    concurrencyQueue.enqueue(async () => {
      try {
        await conversationService.handleIncomingMessage(from, combinedText, mediaItems);
      } catch (error: any) {
        logger.error('Error crítico procesando mensaje desde la cola de concurrencia', { error });
      } finally {
        this.processingPhones.delete(from);
        logger.info(`[EMBUDO] Proceso finalizado para ${from}. Bloqueo liberado.`);
      }
    });
  }
}

export default new MessageQueue();

