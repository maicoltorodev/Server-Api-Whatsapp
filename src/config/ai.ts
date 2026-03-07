import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './index';

export const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);

// AI Tools Configuration
export const tools = {
  functionDeclarations: [
    {
      name: 'update_lead_info',
      description: 'Actualiza el perfil del cliente y su etapa: SALUDO, CALIFICACION, COTIZACION (precios), AGENDA (cupos), CONFIRMACION (cita lista) o DESPEDIDA.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: {
            type: 'STRING',
            description: 'Nombre REAL del humano (persona). PROHIBIDO usar "Cliente de [Mascota]".'
          },
          product_service: { type: 'STRING' },
          current_step: { type: 'STRING', enum: ['SALUDO', 'CALIFICACION', 'COTIZACION', 'AGENDA', 'CONFIRMACION', 'DESPEDIDA'] }
        },
      },
    },
    {
      name: 'check_availability',
      description:
        'Consulta espacios libres en la agenda para una fecha y hora específica antes de ofrecer turnos.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'Fecha a consultar (formato YYYY-MM-DD)' },
          time: {
            type: 'STRING',
            description: "Hora aproximada o exacta consultar (ej: '09:00', 'mañana', 'tarde')",
            nullable: true,
          },
          duration_minutes: {
            type: 'INTEGER',
            description:
              'Duración en minutos del servicio que desea el cliente (obtenido del catálogo).',
            nullable: true,
          },
        },
        required: ['date'],
      },
    },
    {
      name: 'book_appointment',
      description:
        'Crea una cita definitiva. Úsala solo cuando el cliente confirme explícitamente el servicio, fecha y hora exacta.',
      parameters: {
        type: 'OBJECT',
        properties: {
          customer_name: {
            type: 'STRING',
            description: 'Nombre REAL y apellido de la PERSONA (Humano). PROHIBIDO usar el nombre de la mascota o "Cliente de [Mascota]".',
          },
          service: { type: 'STRING', description: 'El servicio a agendar (ej. Baño, Peluquería)' },
          pet_name: {
            type: 'STRING',
            description:
              "Nombre EXACTO de la mascota a agendar. NUNCA agrupes múltiples nombres (ej. usa 'Ñapa', NUNCA 'Ñapa y Embale').",
          },
          date: { type: 'STRING', description: 'Fecha confirmada (formato YYYY-MM-DD)' },
          start_time: { type: 'STRING', description: 'Hora de inicio confirmada (formato HH:MM)' },
          duration_minutes: {
            type: 'INTEGER',
            description: 'Duración en minutos según el catálogo.',
          },
        },
        required: ['customer_name', 'service', 'pet_name', 'date', 'start_time', 'duration_minutes'],
      },
    },
    {
      name: 'cancel_appointment',
      description:
        'Cancela una cita existente. Úsala para cancelaciones directas o antes de reagendar a una nueva fecha/hora.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'Fecha de la cita a cancelar (formato YYYY-MM-DD)' },
          start_time: {
            type: 'STRING',
            description:
              'Hora exacta de la cita a cancelar (formato HH:MM). OBLIGATORIO para no cancelar la cita equivocada de ese día.',
          },
        },
        required: ['date', 'start_time'],
      },
    },
    {
      name: 'transfer_to_human',
      description:
        'Transfiere el chat a un humano si el cliente lo pide, está molesto o el caso es complejo.',
      parameters: {
        type: 'OBJECT',
        properties: {
          reason: {
            type: 'STRING',
            description:
              'Breve razón o motivo de por qué de la transferencia (ej: cliente enojado, caso complejo, pidió humano explícitamente).',
          },
        },
        required: ['reason'],
      },
    },
    {
      name: 'save_pet_preference',
      description:
        'Guarda datos vitales de la mascota: raza (breed), salud (medical), conducta (behavior) o gustos (preferences).',
      parameters: {
        type: 'OBJECT',
        properties: {
          pet_name: {
            type: 'STRING',
            description:
              "Nombre de la mascota (ej. 'Baly', 'Luna'). Úsalo siempre para distinguir entre diferentes mascotas del mismo dueño.",
          },
          category: {
            type: 'STRING',
            enum: ['breed', 'medical', 'behavior', 'preferences', 'notes'],
            description: 'Categoría del historial. Usa "breed" para la raza, "medical" para Salud y Cuidados.',
          },
          value: {
            type: 'STRING',
            description:
              "El dato a guardar (ej. 'Dermatitis en pata', 'Nervioso con secadora', 'Alergia al shampoo').",
          },
        },
        required: ['pet_name', 'category', 'value'],
      },
    },
  ],
};

