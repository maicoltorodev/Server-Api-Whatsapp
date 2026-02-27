const cron = require('node-cron');
const appointmentService = require('../services/appointmentService');
const notificationService = require('../services/notificationService');
const config = require('../config');

class ReminderJob {
  isScheduled: boolean;

  constructor() {
    this.isScheduled = false;
  }

  /**
   * Inicia el job programado de recordatorios
   */
  start() {
    if (this.isScheduled) {
      console.log("⚠️ El job de recordatorios ya está programado.");
      return;
    }

    // Se ejecuta a las 7:30 AM todos los días hora Bogotá
    cron.schedule('30 7 * * *', async () => {
      console.log("⏰ Ejecutando cronjob: Envío masivo de recordatorios diarios...");
      await this.sendDailyReminders();
    }, {
      scheduled: true,
      timezone: config.TIMEZONE
    });

    this.isScheduled = true;
    console.log("✅ Job de recordatorios programado para las 7:30 AM (hora Bogotá).");
  }

  /**
   * Envía recordatorios del día
   */
  async sendDailyReminders() {
    try {
      // Obtener fecha actual en Bogotá
      const boDate = new Date(new Date().toLocaleString("en-US", {
        timeZone: config.TIMEZONE
      }));
      const todayStr = `${boDate.getFullYear()}-${(boDate.getMonth() + 1).toString().padStart(2, '0')}-${boDate.getDate().toString().padStart(2, '0')}`;

      const appointments = await appointmentService.getAppointmentsForDay(todayStr);

      if (appointments && appointments.length > 0) {
        for (const appointment of appointments) {
          const message = `¡Buenos días! 🐾 Te escribimos de Pet Care Studio para recordarte la cita de ${appointment.pet_name} para hoy a las ${appointment.start_time.substring(0, 5)}. ¡Te esperamos! 😊 (Evita responder a este SMS automatizado)`;

          // Enviar por SMS (fuera de ventana de 24h de WhatsApp)
          await notificationService.sendSMS(appointment.phone, message);

          // Pausar 1 segundo entre envíos para evitar rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log(`✅ ¡Se enviaron ${appointments.length} recordatorios automáticos!`);
      } else {
        console.log("No hay citas aprobadas para recordar hoy.");
      }
    } catch (error) {
      console.error("Error al enviar recordatorios cron:", error);
    }
  }

  /**
   * Detiene el job programado
   */
  stop() {
    if (this.isScheduled) {
      cron.getTasks().forEach(task => task.stop());
      this.isScheduled = false;
      console.log("⏹️ Job de recordatorios detenido.");
    }
  }
}

module.exports = new ReminderJob();
