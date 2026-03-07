import { GoogleGenerativeAI } from '@google/generative-ai';
import config from './index';

export const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);

// AI Tools Configuration
export const tools = {
  functionDeclarations: [
    {
      name: 'update_lead_info',
      description: 'Actualiza perfil y etapa actual del cliente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Nombre real del cliente.' },
          product_service: { type: 'STRING', description: 'Servicio de interés.' },
          current_step: { type: 'STRING', enum: ['SALUDO', 'CALIFICACION', 'COTIZACION', 'AGENDA', 'CONFIRMACION', 'DESPEDIDA'] }
        },
      },
    },
    {
      name: 'check_availability',
      description: 'Consulta disponibilidad en la agenda.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'Fecha (YYYY-MM-DD)' },
          time: { type: 'STRING', description: 'Hora o bloque (ej: 09:00, mañana)' },
          duration: { type: 'INTEGER', description: 'Duración en minutos.' },
        },
        required: ['date'],
      },
    },
    {
      name: 'book_appointment',
      description: 'Crea una cita definitiva.',
      parameters: {
        type: 'OBJECT',
        properties: {
          customer_name: { type: 'STRING', description: 'Nombre real del cliente.' },
          service: { type: 'STRING', description: 'Servicio a agendar.' },
          pet_name: { type: 'STRING', description: 'Nombre de la mascota (solo uno).' },
          date: { type: 'STRING', description: 'Fecha (YYYY-MM-DD)' },
          start_time: { type: 'STRING', description: 'Hora (HH:MM)' },
          duration: { type: 'INTEGER', description: 'Minutos duración.' },
        },
        required: ['customer_name', 'service', 'pet_name', 'date', 'start_time', 'duration'],
      },
    },
    {
      name: 'cancel_appointment',
      description: 'Cancela una cita existente.',
      parameters: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'Fecha (YYYY-MM-DD)' },
          start_time: { type: 'STRING', description: 'Hora exacta (HH:MM)' },
        },
        required: ['date', 'start_time'],
      },
    },
    {
      name: 'transfer_to_human',
      description: 'Transfiere a un agente humano.',
      parameters: {
        type: 'OBJECT',
        properties: {
          reason: { type: 'STRING', description: 'Motivo de transferencia.' },
        },
        required: ['reason'],
      },
    },
    {
      name: 'save_pet_preference',
      description: 'Guarda datos históricos de la mascota.',
      parameters: {
        type: 'OBJECT',
        properties: {
          pet_name: { type: 'STRING', description: 'Nombre mascota.' },
          category: { type: 'STRING', enum: ['breed', 'medical', 'behavior', 'preferences', 'notes'] },
          value: { type: 'STRING', description: 'Detalle a guardar.' },
        },
        required: ['pet_name', 'category', 'value'],
      },
    },
  ],
};

