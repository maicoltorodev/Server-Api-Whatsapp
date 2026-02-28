const leadModel = require('../models/leadModel');
const chatModel = require('../models/chatModel');
const aiService = require('./aiService');
const whatsappService = require('./whatsappService');
const notificationService = require('./notificationService');
const systemEvents = require('../utils/eventEmitter');
const logger = require('../utils/logger').default;
import { ILeadProfile, LeadProfileSchema } from '../types';

class ConversationService {
  /**
   * Procesa un mensaje entrante de un cliente de principio a fin
   */
  async handleIncomingMessage(phone: string, message: string) {
    logger.info(`--- 🤖 ORQUESTADOR DE CONVERSACIÓN: ${phone} ---`);

    // 1. Obtener o crear Lead Raw
    let rawLead = await leadModel.getByPhone(phone);
    if (!rawLead) {
      logger.info(`Lead nuevo detectado. Creando perfil inicial para ${phone}...`);
      rawLead = await leadModel.upsert({ phone, name: 'Nuevo Cliente', bot_active: true });
    }

    // Obtenemos el tipo validado estrictamente (Fallback a crudo si la migración de BD tiene esquemas raros)
    const parsed = LeadProfileSchema.safeParse(rawLead);
    const leadData: ILeadProfile = parsed.success ? parsed.data : (rawLead as any);

    logger.info(
      `Lead existente: ${leadData.name || 'Sin nombre'} | Bot Activo: ${leadData.bot_active} | Etapa: ${leadData.current_step}`
    );

    // 2. Registrar mensaje del cliente
    logger.info(`Guardando mensaje del cliente en historial...`);
    await chatModel.addMessage(phone, { role: 'user', parts: [{ text: message }] });

    // Notificar al dashboard que hay un nuevo mensaje (sin esperar a la IA)
    systemEvents.emit('lead_updated', { phone, type: 'new_message' });
    logger.info(`Evento 'lead_updated' emitido al Dashboard.`);

    // 3. Verificar si el bot debe responder
    if (leadData.bot_active === false) {
      logger.info(`El Bot está pausado para este cliente. No se generará respuesta automática.`);
      return await this.handleHumanIntervention(phone, leadData, message);
    }

    // 4. Procesar con IA
    logger.info(`Iniciando motor de IA para procesar respuesta...`);
    return await this.processWithAI(phone, message, leadData);
  }

  /**
   * Maneja el flujo cuando un humano tiene el control
   */
  async handleHumanIntervention(phone: string, leadData: ILeadProfile, message: string) {
    logger.warn(
      `Notificando al dueño que el cliente [${leadData.name || phone}] requiere atención manual.`
    );
    await notificationService.notifyHumanRequired(phone, leadData.name || 'Cliente', message);
    return { status: 'human_control' };
  }

  /**
   * Orquestación del flujo de IA
   */
  async processWithAI(phone: string, message: string, leadData: ILeadProfile) {
    try {
      // A. Preparar contexto e historial
      logger.info(`Preparando contexto dinámico (catálogo, etapa, resumen)...`);
      const model = await aiService.prepareContext(leadData);

      const history = await chatModel.getHistory(phone);
      logger.info(`Historial cargado: ${history.length} mensajes previos.`);

      // B. Generar respuesta
      logger.info(`Consultando a Gemini...`);
      const aiResponse = await aiService.generateResponse(model, message, history);
      let responseText = '';

      // C. Manejar Function Calls (si existen)
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        logger.info(
          `La IA solicitó ejecutar herramientas: ${aiResponse.functionCalls.map((c) => c.name).join(', ')}`
        );
        const result = await aiService.processFunctionCalls(
          aiResponse.functionCalls,
          aiResponse.chatSession,
          phone
        );
        responseText = result.text;
        logger.info(`Herramientas ejecutadas. Respuesta final de IA obtenida.`);
      } else {
        logger.info(`La IA generó una respuesta de texto directa.`);
        responseText = aiResponse.text;
      }

      // Validación de seguridad para evitar enviar mensajes vacíos a WhatsApp
      if (!responseText || responseText.trim() === '') {
        logger.warn(`La IA no devolvió texto. Usando respuesta amigable por defecto.`);
        responseText = '¡Entendido! ¿En qué más puedo ayudarte con tu mascota? 🐾';
      }

      // D. Persistir cambios de la sesión (historial con respuesta IA)
      logger.info(`Actualizando historial de chat con la respuesta de la IA...`);
      const updatedHistory = await aiResponse.chatSession.getHistory();
      await chatModel.saveHistory(phone, updatedHistory);

      // E. Enviar al cliente
      logger.info(`Enviando respuesta a WhatsApp...`);
      await whatsappService.sendMessage(phone, responseText);
      logger.info(`Respuesta enviada con éxito.`);

      // F. Notificar actualización final
      systemEvents.emit('lead_updated', { phone, type: 'ai_response' });
      logger.info(`Evento 'ai_response' emitido al Dashboard.`);

      return { status: 'ai_responded', text: responseText };
    } catch (error: any) {
      logger.error(`Error en flujo de IA [${phone}]`, { error });
      const errorMsg = 'Disculpa, tuve un pequeño problema técnico. ¿Podrías repetirme eso?';
      await whatsappService.sendMessage(phone, errorMsg);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Envía un mensaje manual desde el panel y pausa la IA
   */
  async sendManualMessage(phone: string, message: string) {
    // 1. Desactivar Bot para dar control al humano
    await leadModel.deactivateBot(phone);

    // 2. Enviar mensaje vía WhatsApp
    await whatsappService.sendMessage(phone, message);

    // 3. Registrar en historial como una nota del sistema
    await chatModel.addMessage(phone, {
      role: 'model',
      parts: [
        {
          text: `[NOTA DEL SISTEMA: UN AGENTE HUMANO INTERVINO Y LE ENVIÓ EL SIGUIENTE MENSAJE AL CLIENTE]: "${message}"`,
        },
      ],
    });

    // 4. Notificar actualización
    systemEvents.emit('lead_updated', { phone, type: 'manual_message', bot_active: false });

    return { status: 'success', bot_deactivated: true };
  }

  /**
   * Cambia el estado del Bot (Activar/Desactivar)
   */
  async toggleBot(phone: string, active: boolean) {
    if (active) {
      await leadModel.activateBot(phone);
      const msg = '¡Listo! El asistente virtual está de nuevo a tu disposición. 🤖';
      await whatsappService.sendMessage(phone, msg);
      await chatModel.addMessage(phone, {
        role: 'model',
        parts: [
          {
            text: `[NOTA DEL SISTEMA: SE REACTIVÓ A LA IA. EL SISTEMA ENVIÓ ESTE MENSAJE]: "${msg}"`,
          },
        ],
      });
    } else {
      await leadModel.deactivateBot(phone);
    }

    systemEvents.emit('lead_updated', { phone, type: 'bot_toggle', bot_active: active });
    return { status: 'success', bot_active: active };
  }
}

module.exports = new ConversationService();
