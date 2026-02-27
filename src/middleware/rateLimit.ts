const config = require('../config');

class RateLimiter {
  processedMessages: Set<any>;
  userMessageCount: Map<any, any>;

  constructor() {
    this.processedMessages = new Set();
    this.userMessageCount = new Map();

    // Limpiamos la caché suavemente cada 1 minuto (en vez de hacer clear masivo)
    setInterval(() => {
      const now = Date.now();

      // 1. Limpieza Lazy de los contadores abusivos
      for (const [phone, stamps] of this.userMessageCount.entries()) {
        const validStamps = stamps.filter(t => now - t < config.RATE_LIMIT.WINDOW_MS);
        if (validStamps.length === 0) {
          this.userMessageCount.delete(phone);
        } else {
          this.userMessageCount.set(phone, validStamps);
        }
      }

      // 2. Control de memoria RAM limitando el Set a ~10000 mensajes procesados
      if (this.processedMessages.size > 10000) {
        this.processedMessages.clear();
      }
    }, 60000); // Cada 60 segundos
  }

  /**
   * Verifica si un mensaje ya fue procesado (previene duplicados)
   */
  isMessageProcessed(msgId) {
    if (this.processedMessages.has(msgId)) {
      return true;
    }
    this.processedMessages.add(msgId);
    return false;
  }

  /**
   * Verifica si un usuario excede el límite de mensajes (anti-spam)
   */
  isUserSpamming(userPhone) {
    const now = Date.now();
    let userTimestamps = this.userMessageCount.get(userPhone) || [];

    // Filtramos solo los mensajes recibidos en la ventana de tiempo
    userTimestamps = userTimestamps.filter(timestamp =>
      now - timestamp < config.RATE_LIMIT.WINDOW_MS
    );
    userTimestamps.push(now);
    this.userMessageCount.set(userPhone, userTimestamps);

    return userTimestamps.length > config.RATE_LIMIT.MAX_MESSAGES;
  }
}

module.exports = new RateLimiter();
