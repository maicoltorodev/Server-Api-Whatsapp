const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./index');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// AI Tools Configuration
const tools = {
  functionDeclarations: [
    {
      name: 'update_lead_info',
      description: 'HERRAMIENTA DE MEMORIA: Solo úsala si el humano dice MÍNIMO uno de estos 2 datos clave: [1. Su nombre real] [2. Avanza de etapa (pide separar cita -> pasa a AGENDA)]. PROHIBIDO usarla como diario o cadena de pensamiento. NO la uses de forma rutinaria tras cada mensaje.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: {
            type: 'STRING',
            description: 'Nombre REAL del humano (persona). PROHIBIDO usar "Cliente de [Mascota]".'
          },
          product_service: { type: 'STRING' },
          current_step: { type: 'STRING', enum: ['SALUDO', 'CALIFICACION', 'AGENDA', 'CIERRE'] }
        },
      },
    },
    {
      name: 'check_availability',
      description:
        "HERRAMIENTA OBLIGATORIA: Úsala CADA VEZ que el cliente pregunte si hay cupo, si pueden atender a su mascota, o solicite un turno. JAMÁS respondas 'déjame revisar' sin usar esta herramienta. Verifica en tiempo real los espacios libres en la agenda del estudio.",
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
        'HERRAMIENTA FINAL DE CIERRE: Agendar o separar definitivamente una cita confirmada por el cliente. REQUISITO ESTRICTO: Solo úsala si el cliente ya confirmó explícitamente el día EXACTO y la hora EXACTA tras haberle mostrado la disponibilidad.',
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
        'ACCIÓN DE CANCELACIÓN: Cancela una cita existente. ÚSALA CUANDO: 1. El cliente pide cancelar directamente. 2. Vas a reagendar a un cliente a una nueva hora o día, DEBES cancelar primero la cita original. 3. Si por error reservas algo mal y quieres corregirlo.',
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
        'ACCIÓN DE ESCAPE: Transfiere la conversación del cliente inmediatamente a un agente humano. ÚSALA SI: 1. El cliente está enojado, frustrado o indispuesto. 2. Pide explícitamente hablar con una persona/asesor real. 3. El caso es muy complejo o no está en el catálogo.',
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
        'HERRAMIENTA DE MEMORIA PERMANENTE. Úsala INMEDIATAMENTE cuando el cliente mencione un dato vital o preferencia a largo plazo. 1. MEDICAL: Úsala para Salud y Cuidados (alergias, condiciones médicas como dermatitis, requerimientos de salud). 2. BEHAVIOR: Temperamento y conducta. 3. PREFERENCES: Gustos o miedos. Un cliente puede tener varias mascotas, identifica de cuál habla.',
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

module.exports = {
  genAI,
  tools,
};
