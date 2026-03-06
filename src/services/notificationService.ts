import config from '../config';
import systemEvents from '../utils/eventEmitter';
import logger from '../utils/logger';
import whatsappService from './whatsappService';

export class NotificationService {
  public async notifyOwner(clientPhone: string, clientName: string, message: string) {
    const logContent = `AVISO AL SISTEMA: El cliente ${clientName} (${clientPhone}) necesita atención/tiene actividad.\nMensaje: "${message}"`;
    logger.warn(`---------- 🛎️ ALERTA PARA DASHBOARD ----------\n${logContent}`);

    // TODO: Emitir evento WebSocket o guardar en tabla central de notificaciones
  }

  /**
   * Notifica requerimiento urgente de humano
   */
  public async notifyHumanRequired(clientPhone: string, clientName: string, message: string) {
    const logContent = `URGENTE: El cliente ${clientName} (${clientPhone}) requiere intervención manual.\nMensaje: "${message}"\nEstado Bot: PAUSADO.`;
    logger.warn(`---------- 🛎️ REQUEST HUMANO (DASHBOARD) ----------\n${logContent}`);

    // Emitir evento al Dashboard Administrativo mediante SSE
    systemEvents.emit(
      'human_required',
      JSON.stringify({
        phone: clientPhone,
        name: clientName,
        message: message,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /**
   * Notifica al dueño sobre una nueva cita agendada
   */
  public async notifyNewAppointment(clientPhone: string, clientName: string, appointmentData: any) {
    const message = `🤖 ¡LA IA HA CERRADO UNA CITA!\n🗓️ ${appointmentData.date} a las ${appointmentData.start_time}\n🐶 ${appointmentData.pet_name || 'No dijo'}\n✂️ ${appointmentData.service}`;

    await this.notifyOwner(clientPhone, clientName, message);
  }

  /**
   * Notifica al dueño sobre una cita cancelada
   */
  public async notifyCancelledAppointment(clientPhone: string, appointmentData: any) {
    const message = `⚠️ CITA CANCELADA AUTOMÁTICAMENTE\n🗓️ ${appointmentData.date} a las ${appointmentData.start_time.substring(0, 5)}`;

    await this.notifyOwner(clientPhone, 'Cliente', message);
  }

  /**
   * Notifica error crítico al dueño
   */
  public async notifyCriticalError(clientPhone: string, errorMessage: string) {
    logger.error(`ERROR CRÍTICO EN EL BOT (Cliente: ${clientPhone}): ${errorMessage}`);
    // Opcional: Enviar SMS al Admin
  }

  /**
   * Envía mensaje de error al cliente
   */
  public async notifyClientError(clientPhone: string) {
    try {
      await whatsappService.sendMessage(
        clientPhone,
        'Disculpa, estoy experimentando un pequeño problema técnico 😵‍💫. Un humano tomará mi lugar en breve para ayudarte.'
      );
    } catch (error: any) {
      logger.error('Error notificando error al cliente', { error });
    }
  }
}

export default new NotificationService();

