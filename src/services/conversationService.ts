const leadModel = require('../models/leadModel');
const chatModel = require('../models/chatModel');
const aiService = require('./aiService');
const whatsappService = require('./whatsappService');
const notificationService = require('./notificationService');
const systemLogModel = require('../models/systemLogModel');
const systemEvents = require('../utils/eventEmitter');
const logger = require('../utils/logger').default;
import { ILeadProfile, LeadProfileSchema } from '../types';

class ConversationService {
  /**
   * Procesa un mensaje entrante de un cliente de principio a fin
   */
  async handleIncomingMessage(phone: string, message: string) {
    logger.info(`🤖 [ORQUESTADOR] Iniciando proceso para el número: ${phone}`);

    // 1. Obtener o crear Lead Raw
    logger.info(`[PASO 1] Verificando perfil del cliente en la Base de Datos...`);
    let rawLead = await leadModel.getByPhone(phone);
    if (!rawLead) {
      logger.info(`  ↳ Cliente nuevo. Creando perfil inicial...`);
      rawLead = await leadModel.upsert({
        phone,
        name: 'Nuevo Cliente',
        bot_active: true,
        last_customer_message_at: new Date().toISOString()
      });
    } else {
      // Actualizar el timestamp del último mensaje del cliente
      await leadModel.updateStatus(phone, {
        last_customer_message_at: new Date().toISOString()
      });
    }

    const parsed = LeadProfileSchema.safeParse(rawLead);
    const leadData: ILeadProfile = parsed.success ? parsed.data : (rawLead as any);
    logger.info(`  ↳ Perfil listo: ${leadData.name || 'Sin nombre'} | Etapa: ${leadData.current_step}`);

    // 2. Registrar mensaje del cliente
    logger.info(`[PASO 2] Escribiendo el mensaje entrante en el Historial...`);
    await chatModel.addMessage(phone, { role: 'user', parts: [{ text: message }] });
    systemEvents.emit('lead_updated', { phone, type: 'new_message' });

    // 3. Verificar si el bot debe responder
    logger.info(`[PASO 3] Consultando permisos de intervención del Bot...`);
    if (leadData.bot_active === false) {
      logger.info(`  ↳ Bot en PAUSA. Delegando chat al dueño.`);
      return await this.handleHumanIntervention(phone, leadData, message);
    }
    logger.info(`  ↳ Bot ACTIVO. El Agente Inteligente tomará el caso.`);

    // 4. Procesar con IA
    logger.info(`[PASO 4] Despertando motor de Inteligencia Artificial de Gemini...`);
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
      logger.info(`[IA - INICIO] Preparando contexto dinámico (catálogo, etapa, resumen) para ${phone}...`);
      const model = await aiService.prepareContext(leadData);

      const history = await chatModel.getHistory(phone);
      logger.info(`Historial cargado: ${history.length} mensajes previos.`);

      // B. Generar respuesta
      logger.info(`[IA - PROCESANDO] Consultando a Gemini para ${phone}...`);
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
        logger.warn(`La IA ejecutó procesos pero no generó texto. ACTIVANDO MODO MANUAL para evitar desatención en ${phone}.`);

        // 1. Desactivar Bot por seguridad (Garantía de respuesta humana)
        await leadModel.deactivateBot(phone);

        // 2. Notificar al dueño urgentemente
        await notificationService.notifyHumanRequired(phone, leadData.name || 'Cliente', `[FALLO IA] Miel no generó respuesta a: "${message}"`);

        // 3. Registrar como evento técnico en la DB
        await systemLogModel.log('WARN', 'Fallo técnico (Silencio IA) - Bot desactivado automáticamente', phone, {
          originalMessage: message,
          historyLength: history.length,
          currentLeadStep: leadData.current_step
        });

        systemEvents.emit('lead_updated', { phone, type: 'bot_toggle', bot_active: false });
        return { status: 'ai_responded_no_text_manual_activated' };
      }

      // E. Extraer y Procesar Humor (Mood Tracker)
      let customerMood = 'NEUTRAL';
      const moodMatch = responseText.match(/\[MOOD:\s*(FELIZ|NEUTRAL|MOLESTO|URGENTE)\]/i);
      if (moodMatch) {
        customerMood = moodMatch[1].toUpperCase();
        // Limpiar el tag para que el cliente no lo vea
        responseText = responseText.replace(/\[MOOD:\s*(FELIZ|NEUTRAL|MOLESTO|URGENTE)\]/i, '').trim();

        // Actualizar en DB asíncronamente (sin bloquear la respuesta)
        leadModel.updateStatus(phone, { customer_mood: customerMood }).catch((err: any) => {
          logger.error(`Error actualizando humor para ${phone}:`, err);
        });
      }

      // F. Manejar Silencio Intencional (Despedidas)
      if (responseText.includes('[SILENCIO]')) {
        logger.info(`[IA - SILENCIO] La IA determinó que la conversación ha finalizado. Humor detectado: ${customerMood}.`);
        systemEvents.emit('lead_updated', { phone, type: 'ai_response' });
        return { status: 'ai_silence_intentional' };
      }

      // G. Persistir respuesta de la IA en el historial (de forma incremental)
      logger.info(`[IA - RESPUESTA FINAL] Respuesta para ${phone} [${customerMood}]: "${responseText}"`);
      logger.info(`Guardando la respuesta de la IA en el historial...`);
      await chatModel.addMessage(phone, { role: 'model', parts: [{ text: responseText }] });

      // H. Enviar al cliente
      logger.info(`[PASO 5] Entregando la respuesta de Miel a WhatsApp...`);
      await whatsappService.sendMessage(phone, responseText);
      logger.info(`  ↳ Mensaje de API enviado a ${phone} exitosamente.`);

      // I. Notificar actualización final
      systemEvents.emit('lead_updated', { phone, type: 'ai_response' });
      logger.info(`Evento 'ai_response' emitido al Dashboard.`);

      return { status: 'ai_responded', text: responseText };
    } catch (error: any) {
      logger.error(`❌ [ERROR - IA] Error en flujo de IA [${phone}]`, { error });

      // Persistimos el error en la base de datos para análisis posterior (Senior approach)
      await systemLogModel.log('ERROR', 'Error crítico en flujo processWithAI - Bot desactivado', phone, {
        context: { message, currentLeadStep: leadData.current_step },
        stack: error.stack,
        message: error.message
      });

      // Si hay un error crítico de código, también pasamos a manual para evitar bucles de errores
      await leadModel.deactivateBot(phone);
      await notificationService.notifyHumanRequired(phone, leadData.name || 'Cliente', `[ERROR CRÍTICO] El sistema falló al procesar: "${message}"`);
      systemEvents.emit('lead_updated', { phone, type: 'bot_toggle', bot_active: false });

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
    } else {
      await leadModel.deactivateBot(phone);
    }

    systemEvents.emit('lead_updated', { phone, type: 'bot_toggle', bot_active: active });
    return { status: 'success', bot_active: active };
  }
}

module.exports = new ConversationService();
