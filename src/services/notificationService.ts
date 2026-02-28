const config = require('../config');
const systemEvents = require('../utils/eventEmitter');
const logger = require('../utils/logger').default;

class NotificationService {
  async notifyOwner(clientPhone, clientName, message) {
    const logContent = `AVISO AL SISTEMA: El cliente ${clientName} (${clientPhone}) necesita atención/tiene actividad.\nMensaje: "${message}"`;
    logger.warn(`---------- 🛎️ ALERTA PARA DASHBOARD ----------\n${logContent}`);

    // TODO: Emitir evento WebSocket o guardar en tabla central de notificaciones
  }

  /**
   * Notifica requerimiento urgente de humano
   */
  async notifyHumanRequired(clientPhone, clientName, message) {
    const logContent = `URGENTE: El cliente ${clientName} (${clientPhone}) requiere intervención manual.\nMensaje: "${message}"\nEstado Bot: PAUSADO.`;
    logger.warn(`---------- 🛎️ REQUEST HUMANO (DASHBOARD) ----------\n${logContent}`);

    // Emitir evento al Dashboard Administrativo mediante SSE
    systemEvents.emit('human_required', JSON.stringify({
      phone: clientPhone,
      name: clientName,
      message: message,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Envía SMS automatizado al cliente
   */
  async sendSMS(to, text) {
    logger.info(`---------- ✉️ SMS AUTOMÁTICO AL CLIENTE ----------\nPARA: ${to}\nMENSAJE: ${text}`);

    // Aquí se integraría con Twilio o servicio de SMS real
    return true;
  }

  /**
   * Notifica al dueño sobre una nueva cita agendada
   */
  async notifyNewAppointment(clientPhone, clientName, appointmentData) {
    const message = `🤖 ¡LA IA HA CERRADO UNA CITA!\n🗓️ ${appointmentData.date} a las ${appointmentData.start_time}\n🐶 ${appointmentData.pet_name || 'No dijo'}\n✂️ ${appointmentData.service}`;

    await this.notifyOwner(clientPhone, clientName, message);
  }

  /**
   * Notifica al dueño sobre una cita cancelada
   */
  async notifyCancelledAppointment(clientPhone, appointmentData) {
    const message = `⚠️ CITA CANCELADA AUTOMÁTICAMENTE\n🗓️ ${appointmentData.date} a las ${appointmentData.start_time.substring(0, 5)}`;

    await this.notifyOwner(clientPhone, "Cliente", message);
  }

  /**
   * Notifica error crítico al dueño
   */
  async notifyCriticalError(clientPhone, errorMessage) {
    logger.error(`ERROR CRÍTICO EN EL BOT (Cliente: ${clientPhone}): ${errorMessage}`);
    // Opcional: Enviar SMS al Admin
  }

  /**
   * Envía mensaje de error al cliente
   */
  async notifyClientError(clientPhone) {
    try {
      const whatsappService = require('./whatsappService');
      await whatsappService.sendMessage(
        clientPhone,
        "Disculpa, estoy experimentando un pequeño problema técnico 😵‍💫. Un humano tomará mi lugar en breve para ayudarte."
      );
    } catch (error: any) {
      logger.error("Error notificando error al cliente", { error });
    }
  }
}

module.exports = new NotificationService();
