const appointmentService = require('@/services/appointmentService');
const supabase = require('@/config/database');
const ConfigProvider = require('@/core/config/ConfigProvider');
const validators = require('@/utils/validators');
const notificationService = require('@/services/notificationService');
const config = require('@/config');
const logger = require('@/utils/logger').default;
const DateUtils = require('@/utils/DateUtils').default;

// Mockear todas las dependencias
jest.mock('@/config/database');
jest.mock('@/core/config/ConfigProvider');
jest.mock('@/utils/validators');
jest.mock('@/services/notificationService');
jest.mock('@/config');
jest.mock('@/utils/logger');
jest.mock('@/utils/DateUtils');

describe('AppointmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAvailability', () => {
    it('debería retornar error si la fecha es inválida', async () => {
      validators.isValidDate.mockReturnValue(false);

      const result = await appointmentService.checkAvailability({
        date: 'invalid-date',
        time: '10:00'
      });

      expect(result).toEqual({
        status: 'error',
        message: 'La fecha proporcionada tiene un formato inválido. Debe ser YYYY-MM-DD.'
      });
      expect(validators.isValidDate).toHaveBeenCalledWith('invalid-date');
    });

    it('debería retornar error si es un día cerrado', async () => {
      validators.isValidDate.mockReturnValue(true);
      ConfigProvider.getConfig.mockReturnValue({
        hours: {
          open: '09:00',
          close: '17:00',
          closedDays: [0, 6] // Domingo y Sábado
        }
      });
      DateUtils.createBogotaDate.mockReturnValue(new Date('2024-03-10T12:00:00')); // Domingo

      const result = await appointmentService.checkAvailability({
        date: '2024-03-10',
        time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('días de la fecha solicitada nuestro estudio está cerrado');
    });

    it('debería retornar slots disponibles correctamente', async () => {
      validators.isValidDate.mockReturnValue(true);
      ConfigProvider.getConfig.mockReturnValue({
        hours: {
          open: '09:00',
          close: '17:00',
          closedDays: [],
          concurrency: 2,
          buffer: 15,
          defaultDuration: 60
        }
      });
      DateUtils.createBogotaDate.mockReturnValue(new Date('2024-03-15T12:00:00')); // Viernes

      const mockAppointments = [
        {
          start_time: '09:00:00',
          end_time: '10:00:00'
        },
        {
          start_time: '11:00:00',
          end_time: '12:00:00'
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null
            })
          })
        })
      });

      // Mock del método generateAvailableSlots
      const mockSlots = ['09:30', '10:00', '10:30', '12:00', '12:30', '13:00'];
      jest.spyOn(appointmentService, 'generateAvailableSlots').mockReturnValue(mockSlots);

      const result = await appointmentService.checkAvailability({
        date: '2024-03-15',
        time: '10:00',
        duration_minutes: 60
      });

      expect(result).toEqual({
        status: 'success',
        date: '2024-03-15',
        requested_time: '10:00',
        available_slots: mockSlots,
        message: 'Estos son los bloques de media hora libres.'
      });
    });

    it('debería retornar mensaje de día ocupado si no hay slots', async () => {
      validators.isValidDate.mockReturnValue(true);
      ConfigProvider.getConfig.mockReturnValue({
        hours: {
          open: '09:00',
          close: '17:00',
          closedDays: [],
          concurrency: 2,
          buffer: 15,
          defaultDuration: 60
        }
      });
      DateUtils.createBogotaDate.mockReturnValue(new Date('2024-03-15T12:00:00'));

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      // Mock del método generateAvailableSlots
      jest.spyOn(appointmentService, 'generateAvailableSlots').mockReturnValue([]);

      const result = await appointmentService.checkAvailability({
        date: '2024-03-15',
        time: '10:00'
      });

      expect(result.message).toBe('Ese día está completamente ocupado.');
    });

    it('debería manejar errores de base de datos', async () => {
      validators.isValidDate.mockReturnValue(true);
      ConfigProvider.getConfig.mockReturnValue({
        hours: { open: '09:00', close: '17:00', closedDays: [] }
      });
      DateUtils.createBogotaDate.mockReturnValue(new Date('2024-03-15T12:00:00'));

      const dbError = new Error('Database connection failed');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      });

      const result = await appointmentService.checkAvailability({
        date: '2024-03-15',
        time: '10:00'
      });

      expect(result).toEqual({
        status: 'error',
        message: 'Lo siento, hubo un problema consultando el calendario.'
      });
      expect(logger.error).toHaveBeenCalledWith('Error consultando disponibilidad', { error: dbError });
    });
  });

  describe('generateAvailableSlots', () => {
    it('debería generar slots disponibles correctamente', () => {
      const date = '2024-03-15';
      const config = {
        open: '09:00',
        close: '17:00',
        concurrency: 2,
        buffer: 15,
        defaultDuration: 60
      };
      const existingAppointments = [
        {
          start_time: '09:00:00',
          end_time: '10:00:00'
        },
        {
          start_time: '10:30:00',
          end_time: '11:30:00'
        }
      ];

      // Mock de DateUtils
      DateUtils.createBogotaDate.mockImplementation((dateStr, timeStr) => {
        if (timeStr === '09:00') return new Date('2024-03-15T09:00:00');
        if (timeStr === '17:00') return new Date('2024-03-15T17:00:00');
        if (timeStr === '09:00:00') return new Date('2024-03-15T09:00:00');
        if (timeStr === '10:00:00') return new Date('2024-03-15T10:00:00');
        if (timeStr === '10:30:00') return new Date('2024-03-15T10:30:00');
        if (timeStr === '11:30:00') return new Date('2024-03-15T11:30:00');
        return new Date('2024-03-15T12:00:00');
      });

      DateUtils.addMinutes.mockImplementation((date, minutes) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + minutes);
        return newDate;
      });

      DateUtils.getTodayBogotaStr.mockReturnValue('2024-03-14'); // Ayer
      DateUtils.getNow.mockReturnValue(new Date('2024-03-14T15:00:00'));
      DateUtils.getBogotaTimeString.mockImplementation((date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      });

      const slots = appointmentService.generateAvailableSlots(date, config, existingAppointments, 60);

      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
    });

    it('debería excluir horas pasadas si la cita es para hoy', () => {
      const date = '2024-03-15'; // Hoy
      const config = { open: '09:00', close: '17:00', concurrency: 2, buffer: 15, defaultDuration: 60 };
      const existingAppointments = [];

      DateUtils.createBogotaDate.mockImplementation((dateStr, timeStr) => {
        if (timeStr === '09:00') return new Date('2024-03-15T09:00:00');
        if (timeStr === '17:00') return new Date('2024-03-15T17:00:00');
        return new Date('2024-03-15T12:00:00');
      });

      DateUtils.addMinutes.mockImplementation((date, minutes) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + minutes);
        return newDate;
      });

      DateUtils.getTodayBogotaStr.mockReturnValue('2024-03-15'); // Hoy
      DateUtils.getNow.mockReturnValue(new Date('2024-03-15T10:30:00')); // Ahora son 10:30
      DateUtils.getBogotaTimeString.mockReturnValue('10:00');

      const slots = appointmentService.generateAvailableSlots(date, config, existingAppointments, 60);

      // No debería incluir slots antes de las 10:30
      expect(slots.every(slot => {
        const [hours, minutes] = slot.split(':').map(Number);
        const slotTime = hours * 60 + minutes;
        const nowTime = 10 * 60 + 30; // 10:30
        return slotTime > nowTime;
      })).toBe(true);
    });

    it('debería respetar el límite de concurrencia', () => {
      const date = '2024-03-15';
      const config = { open: '09:00', close: '10:00', concurrency: 1, buffer: 0, defaultDuration: 60 };
      const existingAppointments = [
        {
          start_time: '09:00:00',
          end_time: '10:00:00'
        }
      ];

      DateUtils.createBogotaDate.mockImplementation((dateStr, timeStr) => {
        if (timeStr === '09:00') return new Date('2024-03-15T09:00:00');
        if (timeStr === '10:00') return new Date('2024-03-15T10:00:00');
        if (timeStr === '09:00:00') return new Date('2024-03-15T09:00:00');
        if (timeStr === '10:00:00') return new Date('2024-03-15T10:00:00');
        return new Date('2024-03-15T12:00:00');
      });

      DateUtils.addMinutes.mockImplementation((date, minutes) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + minutes);
        return newDate;
      });

      DateUtils.getTodayBogotaStr.mockReturnValue('2024-03-14');
      DateUtils.getNow.mockReturnValue(new Date('2024-03-14T15:00:00'));
      DateUtils.getBogotaTimeString.mockReturnValue('09:00');

      const slots = appointmentService.generateAvailableSlots(date, config, existingAppointments, 60);

      expect(slots).toEqual([]); // No hay slots disponibles debido a la concurrencia
    });
  });

  describe('bookAppointment', () => {
    it('debería retornar error si la fecha es inválida', async () => {
      validators.isValidDate.mockReturnValue(false);

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'grooming',
        pet_name: 'Firulais',
        date: 'invalid-date',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('formato de fecha');
    });

    it('debería retornar error si la hora es inválida', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(false);

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'grooming',
        pet_name: 'Firulais',
        date: '2024-03-15',
        start_time: 'invalid-time'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('formato de fecha o la hora');
    });

    it('debería retornar error si no se proporciona nombre de mascota', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'grooming',
        pet_name: '',
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('Nombre de la mascota no proporcionado');
    });

    it('debería retornar error si se intentan agendar múltiples mascotas', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'grooming',
        pet_name: 'Firulais y Max',
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('Prohibido agrupar múltiples mascotas');
    });

    it('debería retornar error si la fecha está en el pasado', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);
      validators.isFutureDate.mockReturnValue(false);

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'grooming',
        pet_name: 'Firulais',
        date: '2024-01-01',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('No se puede agendar una cita en el pasado');
    });

    it('debería retornar error si la hora está en el pasado', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);
      validators.isFutureDate.mockReturnValue(true);
      validators.isFutureDateTime.mockReturnValue(false);

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'grooming',
        pet_name: 'Firulais',
        date: '2024-12-31',
        start_time: '08:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('No se puede agendar una cita en una hora que ya pasó');
    });

    it('debería retornar error si el servicio no existe en el catálogo', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);
      validators.isFutureDate.mockReturnValue(true);
      validators.isFutureDateTime.mockReturnValue(true);

      ConfigProvider.getConfig.mockReturnValue({
        hours: { open: '09:00', close: '17:00', concurrency: 2, buffer: 15 }
      });
      ConfigProvider.getCatalogArray.mockReturnValue([
        { title: 'Grooming', duration_minutes: 60 },
        { title: 'Veterinaria', duration_minutes: 30 }
      ]);

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'Servicio Inexistente',
        pet_name: 'Firulais',
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('no existe o es irreconocible');
    });

    it('debería agendar cita exitosamente', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);
      validators.isFutureDate.mockReturnValue(true);
      validators.isFutureDateTime.mockReturnValue(true);

      ConfigProvider.getConfig.mockReturnValue({
        hours: { open: '09:00', close: '17:00', concurrency: 2, buffer: 15 }
      });
      ConfigProvider.getCatalogArray.mockReturnValue([
        { title: 'Grooming', duration_minutes: 60 }
      ]);

      DateUtils.createBogotaDate.mockImplementation((dateStr, timeStr) => {
        if (timeStr === '10:00') return new Date('2024-03-15T10:00:00');
        if (timeStr === '11:00') return new Date('2024-03-15T11:00:00');
        if (timeStr === '17:00') return new Date('2024-03-15T17:00:00');
        return new Date('2024-03-15T12:00:00');
      });

      DateUtils.addMinutes.mockImplementation((date, minutes) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + minutes);
        return newDate;
      });

      DateUtils.getBogotaTimeString.mockReturnValue('11:00');

      // Mock de checkAvailability
      jest.spyOn(appointmentService, 'checkAvailability').mockResolvedValue({
        status: 'success',
        available_slots: ['10:00', '10:30', '11:00']
      });

      // Mock de supabase RPC
      supabase.rpc.mockResolvedValue({
        data: { status: 'success' },
        error: null
      });

      notificationService.notifyNewAppointment.mockResolvedValue();

      const result = await appointmentService.bookAppointment('573001234567', { name: 'Juan Pérez' }, {
        service: 'Grooming',
        pet_name: 'Firulais',
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result).toEqual({
        status: 'success',
        message: 'Cita guardada exitosamente.'
      });

      expect(notificationService.notifyNewAppointment).toHaveBeenCalledWith(
        '573001234567',
        'Juan Pérez',
        {
          date: '2024-03-15',
          start_time: '10:00',
          pet_name: 'Firulais',
          service: 'Grooming'
        }
      );

      expect(logger.info).toHaveBeenCalledWith('Cita creada', {
        metric: 'cita_creada',
        phone: '573001234567',
        service: 'Grooming',
        date: '2024-03-15',
        time: '10:00'
      });
    });

    it('debería retornar error si el slot no está disponible', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);
      validators.isFutureDate.mockReturnValue(true);
      validators.isFutureDateTime.mockReturnValue(true);

      ConfigProvider.getConfig.mockReturnValue({
        hours: { open: '09:00', close: '17:00', concurrency: 2, buffer: 15 }
      });
      ConfigProvider.getCatalogArray.mockReturnValue([
        { title: 'Grooming', duration_minutes: 60 }
      ]);

      // Mock de checkAvailability con slot no disponible
      jest.spyOn(appointmentService, 'checkAvailability').mockResolvedValue({
        status: 'success',
        available_slots: ['09:00', '09:30'] // 10:00 no está disponible
      });

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'Grooming',
        pet_name: 'Firulais',
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toBe('Ese horario específico no está disponible.');
    });
  });

  describe('cancelAppointment', () => {
    it('debería retornar error si la fecha es inválida', async () => {
      validators.isValidDate.mockReturnValue(false);

      const result = await appointmentService.cancelAppointment('573001234567', {
        date: 'invalid-date',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('Fecha inválida');
    });

    it('debería retornar error si la hora es inválida', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(false);

      const result = await appointmentService.cancelAppointment('573001234567', {
        date: '2024-03-15',
        start_time: 'invalid-time'
      });

      expect(result.status).toBe('error');
      expect(result.message).toContain('Hora inválida');
    });

    it('debería cancelar cita exitosamente', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);

      const mockAppointment = {
        id: 'apt_123',
        phone: '573001234567',
        appointment_date: '2024-03-15',
        start_time: '10:00',
        end_time: '11:00',
        status: 'agendada',
        notes: 'Nota original'
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              neq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [mockAppointment],
                    error: null
                  })
                })
              })
            })
          })
        })
      });

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      notificationService.notifyCancelledAppointment.mockResolvedValue();

      const result = await appointmentService.cancelAppointment('573001234567', {
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result).toEqual({
        status: 'success',
        message: '¡La cita fue cancelada exitosamente!'
      });

      expect(notificationService.notifyCancelledAppointment).toHaveBeenCalledWith('573001234567', {
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(logger.info).toHaveBeenCalledWith('Cita cancelada', {
        metric: 'cita_cancelada',
        phone: '573001234567',
        date: '2024-03-15'
      });
    });

    it('debería retornar error si no se encuentra la cita', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              neq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          })
        })
      });

      const result = await appointmentService.cancelAppointment('573001234567', {
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result.status).toBe('error');
      expect(result.message).toBe('No tienes citas agendadas para esa fecha.');
    });
  });

  describe('getAppointmentsForDay', () => {
    it('debería obtener citas para un día específico', async () => {
      const mockAppointments = [
        {
          id: 'apt_1',
          phone: '573001234567',
          pet_name: 'Firulais',
          start_time: '10:00'
        },
        {
          id: 'apt_2',
          phone: '573001234568',
          pet_name: 'Max',
          start_time: '11:00'
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null
            })
          })
        })
      });

      const result = await appointmentService.getAppointmentsForDay('2024-03-15');

      expect(result).toEqual(mockAppointments);
      expect(supabase.from).toHaveBeenCalledWith('appointments');
    });

    it('debería retornar array vacío si no hay citas', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await appointmentService.getAppointmentsForDay('2024-03-15');

      expect(result).toEqual([]);
    });

    it('debería lanzar error si hay error en la base de datos', async () => {
      const dbError = new Error('Database error');
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: dbError
            })
          })
        })
      });

      await expect(appointmentService.getAppointmentsForDay('2024-03-15')).rejects.toThrow(dbError);
    });
  });

  describe('edge cases y validación', () => {
    it('debería manejar duraciones personalizadas', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);
      validators.isFutureDate.mockReturnValue(true);
      validators.isFutureDateTime.mockReturnValue(true);

      ConfigProvider.getConfig.mockReturnValue({
        hours: { open: '09:00', close: '17:00', concurrency: 2, buffer: 15 }
      });
      ConfigProvider.getCatalogArray.mockReturnValue([
        { title: 'Veterinaria', duration_minutes: 30 }
      ]);

      DateUtils.createBogotaDate.mockImplementation((dateStr, timeStr) => {
        if (timeStr === '10:00') return new Date('2024-03-15T10:00:00');
        if (timeStr === '10:30') return new Date('2024-03-15T10:30:00');
        if (timeStr === '17:00') return new Date('2024-03-15T17:00:00');
        return new Date('2024-03-15T12:00:00');
      });

      DateUtils.addMinutes.mockImplementation((date, minutes) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + minutes);
        return newDate;
      });

      DateUtils.getBogotaTimeString.mockReturnValue('10:30');

      jest.spyOn(appointmentService, 'checkAvailability').mockResolvedValue({
        status: 'success',
        available_slots: ['10:00', '10:30']
      });

      supabase.rpc.mockResolvedValue({
        data: { status: 'success' },
        error: null
      });

      notificationService.notifyNewAppointment.mockResolvedValue();

      const result = await appointmentService.bookAppointment('573001234567', {}, {
        service: 'Veterinaria',
        pet_name: 'Michi',
        date: '2024-03-15',
        start_time: '10:00',
        duration_minutes: 30
      });

      expect(result.status).toBe('success');
      // La duración debería ser la del catálogo (30 minutos)
      expect(supabase.rpc).toHaveBeenCalledWith(
        'book_appointment_safe',
        expect.objectContaining({
          p_end_time: '10:30'
        })
      );
    });

    it('debería usar nombre del lead si no se proporciona pet_name', async () => {
      validators.isValidDate.mockReturnValue(true);
      validators.isValidTime.mockReturnValue(true);
      validators.isFutureDate.mockReturnValue(true);
      validators.isFutureDateTime.mockReturnValue(true);

      ConfigProvider.getConfig.mockReturnValue({
        hours: { open: '09:00', close: '17:00', concurrency: 2, buffer: 15 }
      });
      ConfigProvider.getCatalogArray.mockReturnValue([
        { title: 'Grooming', duration_minutes: 60 }
      ]);

      DateUtils.createBogotaDate.mockImplementation((dateStr, timeStr) => {
        if (timeStr === '10:00') return new Date('2024-03-15T10:00:00');
        if (timeStr === '11:00') return new Date('2024-03-15T11:00:00');
        if (timeStr === '17:00') return new Date('2024-03-15T17:00:00');
        return new Date('2024-03-15T12:00:00');
      });

      DateUtils.addMinutes.mockImplementation((date, minutes) => {
        const newDate = new Date(date);
        newDate.setMinutes(newDate.getMinutes() + minutes);
        return newDate;
      });

      DateUtils.getBogotaTimeString.mockReturnValue('11:00');

      jest.spyOn(appointmentService, 'checkAvailability').mockResolvedValue({
        status: 'success',
        available_slots: ['10:00']
      });

      supabase.rpc.mockResolvedValue({
        data: { status: 'success' },
        error: null
      });

      notificationService.notifyNewAppointment.mockResolvedValue();

      const result = await appointmentService.bookAppointment('573001234567', { name: 'Juan Pérez' }, {
        service: 'Grooming',
        pet_name: '',
        date: '2024-03-15',
        start_time: '10:00'
      });

      expect(result.status).toBe('success');
      expect(supabase.rpc).toHaveBeenCalledWith(
        'book_appointment_safe',
        expect.objectContaining({
          p_pet_name: 'Juan Pérez'
        })
      );
    });
  });
});
