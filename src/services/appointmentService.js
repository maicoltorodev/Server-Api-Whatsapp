const supabase = require('../config/database');
const cacheManager = require('../utils/cache');
const { isValidDate, isValidTime, isFutureDate, isFutureDateTime, isWithinBusinessHours } = require('../utils/validators');
const notificationService = require('./notificationService');
const config = require('../config');

class AppointmentService {
  /**
   * Verifica disponibilidad para una fecha específica
   */
  async checkAvailability({ date, time, duration_minutes = 60 }) {
    // Validaciones básicas
    if (!isValidDate(date)) {
      return {
        status: "error",
        message: "La fecha proporcionada tiene un formato inválido. Debe ser YYYY-MM-DD."
      };
    }

    const agendaConfig = await cacheManager.getAgendaConfig();
    const checkDate = new Date(`${date}T12:00:00-05:00`);

    // Verificar si es un día cerrado
    const closedDays = agendaConfig.closedDays || [];
    if (closedDays.includes(checkDate.getDay())) {
      return {
        status: "error",
        message: `Lo siento, los días de la fecha solicitada nuestro estudio está cerrado.`
      };
    }

    try {
      // Obtener citas existentes para esa fecha
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', date)
        .neq('status', 'cancelada');

      if (error) {
        console.error("Error consultando disponibilidad:", error);
        return {
          status: "error",
          message: "Lo siento, hubo un problema consultando el calendario."
        };
      }

      // Generar slots disponibles
      const availableSlots = this.generateAvailableSlots(date, agendaConfig, appointments, duration_minutes);

      return {
        status: "success",
        date: date,
        requested_time: time || 'any',
        available_slots: availableSlots,
        message: availableSlots.length > 0
          ? "Estos son los bloques de media hora libres."
          : "Ese día está completamente ocupado."
      };
    } catch (error) {
      console.error("Error en checkAvailability:", error);
      return {
        status: "error",
        message: "Error interno del sistema."
      };
    }
  }

  /**
   * Genera slots de tiempo disponibles evaluando la duración completa
   */
  generateAvailableSlots(date, config, existingAppointments, durationMinutes) {
    const libres = [];
    let currentSlot = new Date(`${date}T${config.open}:00-05:00`);
    const closingTime = new Date(`${date}T${config.close}:00-05:00`);
    const duration = parseInt(durationMinutes) || 60; // default a 60 si no envía

    // Obtener epoch crudo de la hora real
    const now = new Date();

    while (currentSlot < closingTime) {
      const testStart = new Date(currentSlot);
      const testEnd = new Date(testStart.getTime() + duration * 60 * 1000);

      // Si el servicio termina después del cierre, truncar la iteración futura
      if (testEnd > closingTime) {
        break;
      }

      // Si la hora de inicio es en el pasado absoluto, omitir y avanzar al siguiente
      if (testStart.getTime() <= now.getTime()) {
        currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
        continue;
      }

      const timeString = `${currentSlot.getHours().toString().padStart(2, '0')}:${currentSlot.getMinutes().toString().padStart(2, '0')}`;

      // Verificar solapamientos para todo el intervalo de [testStart a testEnd]
      let overlappingCount = 0;
      existingAppointments.forEach(appointment => {
        // Normalizar tiempos de bbd (a veces vienen HH:mm:ss)
        const sTime = appointment.start_time.substring(0, 5);
        const eTime = appointment.end_time.substring(0, 5);

        const aStart = new Date(`${date}T${sTime}:00-05:00`);
        const aEnd = new Date(`${date}T${eTime}:00-05:00`);
        const aEndWithBuffer = new Date(aEnd.getTime() + (config.buffer || 0) * 60 * 1000);

        // Si hay cualquier intersección en el rango de tiempo
        if (testStart < aEndWithBuffer && testEnd > aStart) {
          overlappingCount++;
        }
      });

      // Si la cantidad de solapamiento en este intervalo es menor al máximo, se considera libre
      if (overlappingCount < config.concurrency) {
        libres.push(timeString);
      }

      // Avanzar en intervalos de 30 minutos (los turnos empiezan en punto o y media)
      currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
    }

    return libres;
  }

  /**
   * Agenda una nueva cita
   */
  async bookAppointment(phone, leadData, { service, pet_name, date, start_time, duration_minutes }) {
    // Validaciones
    if (!isValidDate(date) || !isValidTime(start_time)) {
      return {
        status: "error",
        message: "El formato de fecha (YYYY-MM-DD) o la hora (HH:MM) es inválido."
      };
    }

    if (!isFutureDate(date)) {
      return {
        status: "error",
        message: "No se puede agendar una cita en el pasado."
      };
    }

    if (!isFutureDateTime(date, start_time)) {
      return {
        status: "error",
        message: "No se puede agendar una cita en una hora que ya pasó."
      };
    }

    // --- Validación Real de Catálogo (Anti-Alucinaciones) ---
    const catalogArray = await cacheManager.getCatalogArray();
    let finalDuration = parseInt(duration_minutes) || 60;
    let finalService = service || 'Servicio General';

    // Si la BD retornó el catálogo real, forzamos concordancia estricta
    if (catalogArray && catalogArray.length > 0) {
      const sanitizedInput = (service || '').toLowerCase().trim();
      const serviceFound = catalogArray.find(s =>
        sanitizedInput.includes(s.title.toLowerCase().trim()) ||
        s.title.toLowerCase().trim().includes(sanitizedInput)
      );

      // Bloqueamos a la IA si se inventa algo
      if (!serviceFound) {
        return {
          status: "error",
          message: `El servicio "${service}" no existe o es irreconocible. Revisa los servicios listados en catálogo y corrige tu solicitud.`
        };
      }

      // Reemplazamos la duración que envió la IA por la real en BD
      finalDuration = parseInt(serviceFound.duration_minutes) || 60;
      // Sanitizamos el nombre del texto a guardar
      finalService = serviceFound.title;
    }

    const agendaConfig = await cacheManager.getAgendaConfig();

    // Calcular horas exactas usando duración real
    const exactStart = new Date(`${date}T${start_time}:00-05:00`);
    const exactEnd = new Date(exactStart.getTime() + finalDuration * 60 * 1000);
    const end_time = `${exactEnd.getHours().toString().padStart(2, '0')}:${exactEnd.getMinutes().toString().padStart(2, '0')}`;

    // Verificar que no exceda el horario de cierre
    const closingTime = new Date(`${date}T${agendaConfig.close}:00-05:00`);
    if (exactEnd > closingTime) {
      return {
        status: "error",
        message: `La cita excede el horario de cierre (Dura ${finalDuration}mins).`
      };
    }

    try {
      // Verificar disponibilidad real usando la duración final
      const availabilityCheck = await this.checkAvailability({ date, time: start_time, duration_minutes: finalDuration });
      if (availabilityCheck.status === "error") {
        return availabilityCheck;
      }

      // Verificar que el slot específico esté disponible
      if (!availabilityCheck.available_slots.includes(start_time)) {
        return {
          status: "error",
          message: "Ese horario específico no está disponible."
        };
      }

      // Crear la cita usando RPC transaccional para asegurar concurrencia sin Race Conditions
      const { data: rpcResult, error } = await supabase.rpc('book_appointment_safe', {
        p_phone: phone,
        p_pet_name: pet_name || leadData?.name || 'Mascota Cliente',
        p_date: date,
        p_start_time: start_time,
        p_end_time: end_time,
        p_service_notes: `Agendado por IA. Servicio solicitado: ${finalService}`,
        p_concurrency_limit: agendaConfig.concurrency,
        p_buffer_minutes: agendaConfig.buffer,
        p_closing_time: agendaConfig.close + ':00'
      });

      if (error) {
        console.error("Error fatal ejecutando RPC guardando cita:", error);
        return {
          status: "error",
          message: "Error interno de base de datos impidió agendar la cita."
        };
      }

      // Validar la respuesta del RPC manejada en SQL
      if (rpcResult.status === 'error') {
        return {
          status: "error",
          message: rpcResult.message
        };
      }

      // Notificar al dueño
      await notificationService.notifyNewAppointment(phone, leadData?.name || "Cliente", {
        date,
        start_time,
        pet_name,
        service: finalService
      });

      // Registrar métrica de negocio
      console.info(JSON.stringify({
        metric: "cita_creada",
        phone: phone,
        service: finalService,
        date: date,
        time: start_time,
        timestamp: new Date().toISOString()
      }));

      return {
        status: "success",
        message: "Cita guardada exitosamente."
      };

    } catch (error) {
      console.error("Error en bookAppointment:", error);
      return {
        status: "error",
        message: "Error interno del sistema."
      };
    }
  }

  /**
   * Cancela una cita existente
   */
  async cancelAppointment(phone, { date }) {
    if (!isValidDate(date)) {
      return {
        status: "error",
        message: "Fecha inválida (usa YYYY-MM-DD)."
      };
    }

    try {
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('phone', phone)
        .eq('appointment_date', date)
        .neq('status', 'cancelada')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error || !appointments || appointments.length === 0) {
        return {
          status: "error",
          message: "No tienes citas agendadas para esa fecha."
        };
      }

      const appointment = appointments[0];
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelada',
          notes: `${appointment.notes || ''} | Cancelada por el usuario via IA.`
        })
        .eq('id', appointment.id);

      if (updateError) {
        return {
          status: "error",
          message: "Fallo temporal en la base de datos."
        };
      }

      // Notificar al dueño
      await notificationService.notifyCancelledAppointment(phone, {
        date,
        start_time: appointment.start_time
      });

      // Registrar métrica de negocio
      console.info(JSON.stringify({
        metric: "cita_cancelada",
        phone: phone,
        date: date,
        timestamp: new Date().toISOString()
      }));

      return {
        status: "success",
        message: "¡La cita fue cancelada exitosamente!"
      };

    } catch (error) {
      console.error("Error en cancelAppointment:", error);
      return {
        status: "error",
        message: "Error interno del sistema."
      };
    }
  }

  /**
   * Obtiene citas para un día específico (para recordatorios)
   */
  async getAppointmentsForDay(date) {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, phone, pet_name, start_time')
      .eq('appointment_date', date)
      .eq('status', 'agendada');

    if (error) {
      throw error;
    }

    return data || [];
  }
}

module.exports = new AppointmentService();
