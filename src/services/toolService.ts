const leadModel = require('../models/leadModel');
const appointmentService = require('./appointmentService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger').default;

class ToolService {
  /**
   * Actualiza el perfil del lead basado en la conversación
   */
  async update_lead_info(args, phone) {
    logger.info(`[TOOL] Executing: update_lead_info for ${phone}`, { args });
    try {
      if (args.summary) await leadModel.updateSummary(phone, args.summary);

      // Actualizar otros campos si vienen en args (name, pet_name, etc)
      const { summary, ...otherData } = args;
      if (Object.keys(otherData).length > 0) {
        logger.debug(`[TOOL] Updating additional fields`, { otherData });
        await leadModel.updateStatus(phone, otherData);
      }

      logger.info(`[TOOL] Success: Lead info updated.`);
      return { status: 'ok', message: 'Información actualizada correctamente.' };
    } catch (error: any) {
      logger.error(`[TOOL] Error updating lead info`, { error });
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Consulta disponibilidad de citas
   */
  async check_availability(args) {
    logger.info(`[TOOL] Executing: check_availability`, { args });
    const result = await appointmentService.checkAvailability(args);
    logger.info(`[TOOL] Result: Found ${result.available_slots?.length || 0} slots.`);
    return result;
  }

  /**
   * Reserva una cita
   */
  async book_appointment(args, phone) {
    logger.info(`[TOOL] Executing: book_appointment for ${phone}`, { args });
    const leadData = await leadModel.getByPhone(phone);
    const result = await appointmentService.bookAppointment(phone, leadData, args);

    if (result.status === 'success') {
      logger.info(`[TOOL] Success: Appointment booked. Moving lead to 'AGENDA' stage.`);
      await leadModel.updateStep(phone, 'AGENDA');
    } else {
      logger.warn(`[TOOL] Failed to book: ${result.message}`);
    }

    return result;
  }

  /**
   * Cancela una cita
   */
  async cancel_appointment(args, phone) {
    logger.info(`[TOOL] Executing: cancel_appointment for ${phone}`, { args });
    const result = await appointmentService.cancelAppointment(phone, args);
    logger.info(`[TOOL] Result: ${result.status}`);
    return result;
  }

  /**
   * Solicita intervención humana
   */
  async transfer_to_human(args, phone) {
    logger.warn(`[TOOL] EXECUTING: transfer_to_human for ${phone}`);
    const leadData = await leadModel.getByPhone(phone);
    await leadModel.deactivateBot(phone);
    await notificationService.notifyOwner(
      phone,
      leadData?.name || 'Cliente',
      'Solicitud de transferencia a humano'
    );
    logger.warn(`[TOOL] Bot deactivated. Human notified.`);

    return {
      status: 'transferred',
      message: 'Se ha notificado a un agente humano. El bot ha sido desactivado para este chat.',
    };
  }

  /**
   * Memoria a largo plazo - Guarda información permanente de la mascota
   */
  async save_pet_preference(args, phone) {
    logger.info(`[TOOL] EXECUTING: save_pet_preference for ${phone}`, { args });
    try {
      const { category, value, pet_name } = args;
      await leadModel.updateMedicalHistory(phone, category, value, pet_name);
      logger.info(`[TOOL] Success: Preference saved in medical_history for pet: ${pet_name}.`);
      return {
        status: 'saved',
        message: `Dato guardado permanentemente para '${pet_name}' en la categoría '${category}'. Ahora lo recordarás siempre.`,
      };
    } catch (error: any) {
      logger.error(`[TOOL] Error saving preference`, { error });
      return { status: 'error', message: 'Fallo al guardar el historial médico.' };
    }
  }
}

module.exports = new ToolService();
