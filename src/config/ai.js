const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./index');

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// AI Tools Configuration
const tools = {
  functionDeclarations: [
    {
      name: "update_lead_info",
      description: "Actualiza la información del cliente y el estado del embudo de ventas.",
      parameters: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          product_service: { type: "STRING" },
          appointment_date: { type: "STRING" },
          budget: { type: "STRING" },
          current_step: { type: "STRING", enum: ["SALUDO", "CALIFICACION", "AGENDA", "CIERRE"] },
          summary: { type: "STRING", description: "Resumen ejecutivo actualizado." }
        }
      }
    },
    {
      name: "check_availability",
      description: "Verifica si hay turnos disponibles para agendar un servicio en una fecha u hora específica para el Pet Care Studio.",
      parameters: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "Fecha a consultar (formato YYYY-MM-DD)" },
          time: { type: "STRING", description: "Hora aproximada o exacta consultar (ej: '09:00', 'mañana', 'tarde')", nullable: true },
          duration_minutes: { type: "INTEGER", description: "Duración en minutos del servicio que desea el cliente (obtenido del catálogo).", nullable: true }
        },
        required: ["date"]
      }
    },
    {
      name: "book_appointment",
      description: "Agendar o separar definitivamente una cita confirmada por el cliente. Solo úsalo si el cliente ya confirmó el día y la hora exacta.",
      parameters: {
        type: "OBJECT",
        properties: {
          service: { type: "STRING", description: "El servicio a agendar (ej. Baño, Peluquería)" },
          pet_name: { type: "STRING", description: "Nombre de la mascota (si se sabe)", nullable: true },
          date: { type: "STRING", description: "Fecha confirmada (formato YYYY-MM-DD)" },
          start_time: { type: "STRING", description: "Hora de inicio confirmada (formato HH:MM)" },
          duration_minutes: { type: "INTEGER", description: "Duración en minutos según el catálogo." }
        },
        required: ["service", "date", "start_time", "duration_minutes"]
      }
    },
    {
      name: "cancel_appointment",
      description: "Cancela una cita existente. Solo úsalo si el cliente pide explícitamente cancelar su turno.",
      parameters: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "Fecha de la cita a cancelar (formato YYYY-MM-DD)" }
        },
        required: ["date"]
      }
    },
    {
      name: "transfer_to_human",
      description: "Transfiere la conversación del cliente inmediatamente a un agente humano en caso de que esté enojado, frustrado o pida explícitamente hablar con una persona.",
      parameters: {
        type: "OBJECT",
        properties: {
          reason: { type: "STRING", description: "Breve razón o motivo de por qué de la transferencia (ej: cliente enojado, caso complejo, pidió humano explícitamente)." }
        },
        required: ["reason"]
      }
    }
  ]
};

module.exports = {
  genAI,
  tools
};
