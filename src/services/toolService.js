const leadModel = require('../models/leadModel');
const appointmentService = require('./appointmentService');
const notificationService = require('./notificationService');

class ToolService {
    /**
     * Actualiza el perfil del lead basado en la conversación
     */
    async update_lead_info(args, phone) {
        console.log(`   [TOOL] Executing: update_lead_info for ${phone}`);
        console.log(`   [TOOL] Args:`, JSON.stringify(args));
        try {
            if (args.summary) await leadModel.updateSummary(phone, args.summary);

            // Actualizar otros campos si vienen en args (name, pet_name, etc)
            const { summary, ...otherData } = args;
            if (Object.keys(otherData).length > 0) {
                console.log(`   [TOOL] Updating additional fields:`, JSON.stringify(otherData));
                await leadModel.updateStatus(phone, otherData);
            }

            console.log(`   [TOOL] Success: Lead info updated.`);
            return { status: "ok", message: "Información actualizada correctamente." };
        } catch (error) {
            console.error(`   [TOOL] Error updating lead info:`, error.message);
            return { status: "error", message: error.message };
        }
    }

    /**
     * Consulta disponibilidad de citas
     */
    async check_availability(args) {
        console.log(`   [TOOL] Executing: check_availability | Args:`, JSON.stringify(args));
        const result = await appointmentService.checkAvailability(args);
        console.log(`   [TOOL] Result: Found ${result.available_slots?.length || 0} slots.`);
        return result;
    }

    /**
     * Reserva una cita
     */
    async book_appointment(args, phone) {
        console.log(`   [TOOL] Executing: book_appointment for ${phone} | Args:`, JSON.stringify(args));
        const leadData = await leadModel.getByPhone(phone);
        const result = await appointmentService.bookAppointment(phone, leadData, args);

        if (result.status === 'success') {
            console.log(`   [TOOL] Success: Appointment booked. Moving lead to 'AGENDA' stage.`);
            await leadModel.updateStep(phone, 'AGENDA');
        } else {
            console.log(`   [TOOL] Failed to book: ${result.message}`);
        }

        return result;
    }

    /**
     * Cancela una cita
     */
    async cancel_appointment(args, phone) {
        console.log(`   [TOOL] Executing: cancel_appointment for ${phone} | Args:`, JSON.stringify(args));
        const result = await appointmentService.cancelAppointment(phone, args);
        console.log(`   [TOOL] Result: ${result.status}`);
        return result;
    }

    /**
     * Solicita intervención humana
     */
    async transfer_to_human(args, phone) {
        console.log(`🚨 [TOOL] EXECUTING: transfer_to_human for ${phone}`);
        const leadData = await leadModel.getByPhone(phone);
        await leadModel.deactivateBot(phone);
        await notificationService.notifyOwner(phone, leadData?.name || "Cliente", "Solicitud de transferencia a humano");
        console.log(`🚨 [TOOL] Bot deactivated. Human notified.`);

        return {
            status: "transferred",
            message: "Se ha notificado a un agente humano. El bot ha sido desactivado para este chat."
        };
    }
}

module.exports = new ToolService();
