const toolService = require('@/services/toolService');
const leadModel = require('@/models/leadModel');
const appointmentService = require('@/services/appointmentService');
const notificationService = require('@/services/notificationService');
const logger = require('@/utils/logger').default;

// Mockear todas las dependencias
jest.mock('@/models/leadModel');
jest.mock('@/services/appointmentService');
jest.mock('@/services/notificationService');
jest.mock('@/utils/logger');

describe('ToolService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('update_lead_info', () => {
    it('debería actualizar el summary del lead exitosamente', async () => {
      const phone = '573001234567';
      const args = { summary: 'Cliente interesado en grooming para su perro' };

      leadModel.updateSummary.mockResolvedValue();
      leadModel.updateStatus.mockResolvedValue();

      const result = await toolService.update_lead_info(args, phone);

      expect(result).toEqual({
        status: 'ok',
        message: 'Información actualizada correctamente.'
      });
      expect(leadModel.updateSummary).toHaveBeenCalledWith(phone, args.summary);
      expect(leadModel.updateStatus).not.toHaveBeenCalled();
    });

    it('debería actualizar campos adicionales del lead', async () => {
      const phone = '573001234567';
      const args = {
        summary: 'Cliente con cita agendada',
        name: 'Juan Pérez',
        pet_name: 'Firulais',
        pet_type: 'perro'
      };

      leadModel.updateSummary.mockResolvedValue();
      leadModel.updateStatus.mockResolvedValue();

      const result = await toolService.update_lead_info(args, phone);

      expect(result).toEqual({
        status: 'ok',
        message: 'Información actualizada correctamente.'
      });
      expect(leadModel.updateSummary).toHaveBeenCalledWith(phone, args.summary);
      expect(leadModel.updateStatus).toHaveBeenCalledWith(phone, {
        name: 'Juan Pérez',
        pet_name: 'Firulais',
        pet_type: 'perro'
      });
    });

    it('debería manejar errores al actualizar información del lead', async () => {
      const phone = '573001234567';
      const args = { summary: 'Test error' };
      const error = new Error('Database error');

      leadModel.updateSummary.mockRejectedValue(error);

      const result = await toolService.update_lead_info(args, phone);

      expect(result).toEqual({
        status: 'error',
        message: 'Database error'
      });
      expect(logger.error).toHaveBeenCalledWith(
        '[TOOL] Error updating lead info',
        { error }
      );
    });

    it('debería funcionar sin summary si solo hay otros campos', async () => {
      const phone = '573001234567';
      const args = { name: 'María García', pet_name: 'Michi' };

      leadModel.updateStatus.mockResolvedValue();

      const result = await toolService.update_lead_info(args, phone);

      expect(result).toEqual({
        status: 'ok',
        message: 'Información actualizada correctamente.'
      });
      expect(leadModel.updateSummary).not.toHaveBeenCalled();
      expect(leadModel.updateStatus).toHaveBeenCalledWith(phone, args);
    });
  });

  describe('check_availability', () => {
    it('debería consultar disponibilidad de citas', async () => {
      const args = {
        date: '2024-03-15',
        service: 'grooming'
      };
      const mockResult = {
        available_slots: [
          { time: '09:00', available: true },
          { time: '10:30', available: true }
        ],
        total_slots: 2
      };

      appointmentService.checkAvailability.mockResolvedValue(mockResult);

      const result = await toolService.check_availability(args);

      expect(result).toEqual(mockResult);
      expect(appointmentService.checkAvailability).toHaveBeenCalledWith(args);
    });

    it('debería manejar casos sin disponibilidad', async () => {
      const args = {
        date: '2024-03-15',
        service: 'veterinaria'
      };
      const mockResult = {
        available_slots: [],
        total_slots: 0,
        message: 'No hay disponibilidad para esta fecha'
      };

      appointmentService.checkAvailability.mockResolvedValue(mockResult);

      const result = await toolService.check_availability(args);

      expect(result.available_slots).toHaveLength(0);
      expect(result.total_slots).toBe(0);
    });
  });

  describe('book_appointment', () => {
    it('debería reservar cita exitosamente y actualizar etapa del lead', async () => {
      const phone = '573001234567';
      const args = {
        date: '2024-03-15',
        time: '09:00',
        service: 'grooming'
      };
      const leadData = {
        phone,
        name: 'Carlos López',
        current_step: 'inquiry'
      };
      const bookingResult = {
        status: 'success',
        appointment_id: 'apt_123',
        message: 'Cita reservada exitosamente'
      };

      leadModel.getByPhone.mockResolvedValue(leadData);
      appointmentService.bookAppointment.mockResolvedValue(bookingResult);
      leadModel.updateStep.mockResolvedValue();

      const result = await toolService.book_appointment(args, phone);

      expect(result).toEqual(bookingResult);
      expect(leadModel.getByPhone).toHaveBeenCalledWith(phone);
      expect(appointmentService.bookAppointment).toHaveBeenCalledWith(phone, leadData, args);
      expect(leadModel.updateStep).toHaveBeenCalledWith(phone, 'AGENDA');
    });

    it('debería manejar fallos en la reserva de cita', async () => {
      const phone = '573001234567';
      const args = {
        date: '2024-03-15',
        time: '09:00',
        service: 'grooming'
      };
      const leadData = {
        phone,
        name: 'Ana Martínez',
        current_step: 'inquiry'
      };
      const bookingResult = {
        status: 'error',
        message: 'El horario solicitado ya no está disponible'
      };

      leadModel.getByPhone.mockResolvedValue(leadData);
      appointmentService.bookAppointment.mockResolvedValue(bookingResult);

      const result = await toolService.book_appointment(args, phone);

      expect(result).toEqual(bookingResult);
      expect(leadModel.updateStep).not.toHaveBeenCalled();
    });

    it('debería manejar errores en el servicio de citas', async () => {
      const phone = '573001234567';
      const args = {
        date: '2024-03-15',
        time: '09:00',
        service: 'grooming'
      };
      const error = new Error('Service unavailable');

      leadModel.getByPhone.mockRejectedValue(error);

      await expect(toolService.book_appointment(args, phone)).rejects.toThrow(error);
    });
  });

  describe('cancel_appointment', () => {
    it('debería cancelar cita exitosamente', async () => {
      const phone = '573001234567';
      const args = {
        appointment_id: 'apt_123',
        reason: 'Cliente cambió de opinión'
      };
      const cancelResult = {
        status: 'success',
        message: 'Cita cancelada exitosamente'
      };

      appointmentService.cancelAppointment.mockResolvedValue(cancelResult);

      const result = await toolService.cancel_appointment(args, phone);

      expect(result).toEqual(cancelResult);
      expect(appointmentService.cancelAppointment).toHaveBeenCalledWith(phone, args);
    });

    it('debería manejar fallos en la cancelación', async () => {
      const phone = '573001234567';
      const args = {
        appointment_id: 'apt_123'
      };
      const cancelResult = {
        status: 'error',
        message: 'No se encontró la cita'
      };

      appointmentService.cancelAppointment.mockResolvedValue(cancelResult);

      const result = await toolService.cancel_appointment(args, phone);

      expect(result.status).toBe('error');
      expect(result.message).toBe('No se encontró la cita');
    });
  });

  describe('transfer_to_human', () => {
    it('debería transferir a humano y desactivar bot', async () => {
      const phone = '573001234567';
      const args = { reason: 'Consulta compleja sobre tratamiento' };
      const leadData = {
        phone,
        name: 'Roberto Díaz',
        current_step: 'complex_query'
      };

      leadModel.getByPhone.mockResolvedValue(leadData);
      leadModel.deactivateBot.mockResolvedValue();
      notificationService.notifyOwner.mockResolvedValue();

      const result = await toolService.transfer_to_human(args, phone);

      expect(result).toEqual({
        status: 'transferred',
        message: 'Se ha notificado a un agente humano. El bot ha sido desactivado para este chat.'
      });
      expect(leadModel.getByPhone).toHaveBeenCalledWith(phone);
      expect(leadModel.deactivateBot).toHaveBeenCalledWith(phone);
      expect(notificationService.notifyOwner).toHaveBeenCalledWith(
        phone,
        'Roberto Díaz',
        'Solicitud de transferencia a humano'
      );
    });

    it('debería usar nombre por defecto si el lead no tiene nombre', async () => {
      const phone = '573001234567';
      const args = {};
      const leadData = {
        phone,
        name: null,
        current_step: 'help'
      };

      leadModel.getByPhone.mockResolvedValue(leadData);
      leadModel.deactivateBot.mockResolvedValue();
      notificationService.notifyOwner.mockResolvedValue();

      const result = await toolService.transfer_to_human(args, phone);

      expect(notificationService.notifyOwner).toHaveBeenCalledWith(
        phone,
        'Cliente',
        'Solicitud de transferencia a humano'
      );
    });

    it('debería manejar errores en la transferencia', async () => {
      const phone = '573001234567';
      const args = {};
      const error = new Error('Notification failed');

      leadModel.getByPhone.mockResolvedValue({ phone, name: 'Test' });
      leadModel.deactivateBot.mockResolvedValue();
      notificationService.notifyOwner.mockRejectedValue(error);

      await expect(toolService.transfer_to_human(args, phone)).rejects.toThrow(error);
    });
  });

  describe('save_pet_preference', () => {
    it('debería guardar preferencia de mascota exitosamente', async () => {
      const phone = '573001234567';
      const args = {
        category: 'alergias',
        value: 'Polen y pollo',
        pet_name: 'Luna'
      };

      leadModel.updateMedicalHistory.mockResolvedValue();

      const result = await toolService.save_pet_preference(args, phone);

      expect(result).toEqual({
        status: 'saved',
        message: "Dato guardado permanentemente para 'Luna' en la categoría 'alergias'. Ahora lo recordarás siempre."
      });
      expect(leadModel.updateMedicalHistory).toHaveBeenCalledWith(
        phone,
        'alergias',
        'Polen y pollo',
        'Luna'
      );
    });

    it('debería manejar diferentes categorías de preferencias', async () => {
      const phone = '573001234567';
      const args = {
        category: 'comida_favorita',
        value: 'Pollo asado con arroz',
        pet_name: 'Max'
      };

      leadModel.updateMedicalHistory.mockResolvedValue();

      const result = await toolService.save_pet_preference(args, phone);

      expect(result.status).toBe('saved');
      expect(result.message).toContain('Max');
      expect(result.message).toContain('comida_favorita');
    });

    it('debería manejar errores al guardar preferencias', async () => {
      const phone = '573001234567';
      const args = {
        category: 'medicamentos',
        value: 'Antihistamínicos',
        pet_name: 'Bella'
      };
      const error = new Error('Medical history save failed');

      leadModel.updateMedicalHistory.mockRejectedValue(error);

      const result = await toolService.save_pet_preference(args, phone);

      expect(result).toEqual({
        status: 'error',
        message: 'Fallo al guardar el historial médico.'
      });
      expect(logger.error).toHaveBeenCalledWith(
        '[TOOL] Error saving preference',
        { error }
      );
    });

    it('debería requerir todos los campos necesarios', async () => {
      const phone = '573001234567';
      const args = {
        category: 'alergias',
        value: 'Polen'
        // Falta pet_name
      };

      leadModel.updateMedicalHistory.mockResolvedValue();

      const result = await toolService.save_pet_preference(args, phone);

      expect(leadModel.updateMedicalHistory).toHaveBeenCalledWith(
        phone,
        'alergias',
        'Polen',
        undefined
      );
    });
  });

  describe('logging y monitoreo', () => {
    it('debería loggear la ejecución de cada herramienta', async () => {
      const phone = '573001234567';

      // Test update_lead_info
      await toolService.update_lead_info({ summary: 'Test' }, phone);
      expect(logger.info).toHaveBeenCalledWith(
        '[TOOL] Executing: update_lead_info for 573001234567',
        { args: { summary: 'Test' } }
      );

      jest.clearAllMocks();

      // Test check_availability
      await toolService.check_availability({ date: '2024-03-15' });
      expect(logger.info).toHaveBeenCalledWith(
        '[TOOL] Executing: check_availability',
        { args: { date: '2024-03-15' } }
      );

      jest.clearAllMocks();

      // Test book_appointment
      leadModel.getByPhone.mockResolvedValue({ phone });
      appointmentService.bookAppointment.mockResolvedValue({ status: 'success' });
      await toolService.book_appointment({ date: '2024-03-15' }, phone);
      expect(logger.info).toHaveBeenCalledWith(
        '[TOOL] Executing: book_appointment for 573001234567',
        { args: { date: '2024-03-15' } }
      );
    });

    it('debería loggear resultados exitosos', async () => {
      const phone = '573001234567';

      leadModel.updateSummary.mockResolvedValue();
      leadModel.updateStatus.mockResolvedValue();

      await toolService.update_lead_info({ summary: 'Test' }, phone);

      expect(logger.info).toHaveBeenCalledWith('[TOOL] Success: Lead info updated.');
    });

    it('debería loggear advertencias en operaciones fallidas', async () => {
      const phone = '573001234567';

      leadModel.getByPhone.mockResolvedValue({ phone });
      appointmentService.bookAppointment.mockResolvedValue({
        status: 'error',
        message: 'No disponible'
      });

      await toolService.book_appointment({ date: '2024-03-15' }, phone);

      expect(logger.warn).toHaveBeenCalledWith('[TOOL] Failed to book: No disponible');
    });
  });

  describe('edge cases y validación', () => {
    it('debería manejar args vacíos o nulos', async () => {
      const phone = '573001234567';

      leadModel.updateStatus.mockResolvedValue();

      const result = await toolService.update_lead_info({}, phone);

      expect(result.status).toBe('ok');
      expect(leadModel.updateStatus).toHaveBeenCalledWith(phone, {});
    });

    it('debería manejar números de teléfono inválidos', async () => {
      const phone = '';
      const args = { summary: 'Test' };

      leadModel.updateSummary.mockRejectedValue(new Error('Invalid phone'));

      const result = await toolService.update_lead_info(args, phone);

      expect(result.status).toBe('error');
    });

    it('debería manejar datos muy largos en preferencias', async () => {
      const phone = '573001234567';
      const longValue = 'A'.repeat(1000);
      const args = {
        category: 'notas_medicas',
        value: longValue,
        pet_name: 'TestPet'
      };

      leadModel.updateMedicalHistory.mockResolvedValue();

      const result = await toolService.save_pet_preference(args, phone);

      expect(result.status).toBe('saved');
      expect(leadModel.updateMedicalHistory).toHaveBeenCalledWith(
        phone,
        'notas_medicas',
        longValue,
        'TestPet'
      );
    });
  });
});
