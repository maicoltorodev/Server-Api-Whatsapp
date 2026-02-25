const leadModel = require('../models/leadModel');
const chatModel = require('../models/chatModel');
const aiService = require('./aiService');
const whatsappService = require('./whatsappService');
const notificationService = require('./notificationService');
const systemEvents = require('../utils/eventEmitter');

class ConversationService {
  /**
   * Procesa un mensaje entrante de un cliente de principio a fin
   */
  async handleIncomingMessage(phone, message) {
    console.log(`\n--- 🤖 ORQUESTADOR DE CONVERSACIÓN: ${phone} ---`);

    // 1. Obtener o crear Lead
    let leadData = await leadModel.getByPhone(phone);
    if (!leadData) {
      console.log(`👤 Lead nuevo detectado. Creando perfil inicial para ${phone}...`);
      leadData = await leadModel.upsert({ phone, name: 'Nuevo Cliente', bot_active: true });
    } else {
      console.log(`👤 Lead existente: ${leadData.name || 'Sin nombre'} | Bot Activo: ${leadData.bot_active} | Etapa: ${leadData.current_step}`);
    }

    // 2. Registrar mensaje del cliente
    console.log(`💾 Guardando mensaje del cliente en historial...`);
    await chatModel.addMessage(phone, { role: 'user', parts: [{ text: message }] });

    // Notificar al dashboard que hay un nuevo mensaje (sin esperar a la IA)
    systemEvents.emit('lead_updated', { phone, type: 'new_message' });
    console.log(`📡 Evento 'lead_updated' emitido al Dashboard.`);

    // 3. Verificar si el bot debe responder
    if (leadData.bot_active === false) {
      console.log(`⏸️ El Bot está pausado para este cliente. No se generará respuesta automática.`);
      return await this.handleHumanIntervention(phone, leadData, message);
    }

    // 4. Procesar con IA
    console.log(`🧠 Iniciando motor de IA para procesar respuesta...`);
    return await this.processWithAI(phone, message, leadData);
  }

  /**
   * Maneja el flujo cuando un humano tiene el control
   */
  async handleHumanIntervention(phone, leadData, message) {
    console.log(`🚨 Notificando al dueño que el cliente [${leadData.name || phone}] requiere atención manual.`);
    await notificationService.notifyHumanRequired(phone, leadData.name || "Cliente", message);
    return { status: 'human_control' };
  }

  /**
   * Orquestación del flujo de IA
   */
  async processWithAI(phone, message, leadData) {
    try {
      // A. Preparar contexto e historial
      console.log(`📚 Preparando contexto dinámico (catálogo, etapa, resumen)...`);
      await aiService.prepareContext(leadData);

      const history = await chatModel.getHistory(phone);
      console.log(`   Historial cargado: ${history.length} mensajes previos.`);

      // B. Generar respuesta
      console.log(`✨ Consultando a Gemini...`);
      const aiResponse = await aiService.generateResponse(message, history);
      let responseText = "";

      // C. Manejar Function Calls (si existen)
      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        console.log(`🛠️ La IA solicitó ejecutar una herramienta: ${aiResponse.functionCalls[0].name}`);
        const call = aiResponse.functionCalls[0];
        const result = await aiService.processFunctionCall(call, aiResponse.chatSession, phone, leadData);
        responseText = result.text;
        console.log(`✅ Herramienta ejecutada. Respuesta final de IA obtenida.`);
      } else {
        console.log(`💬 La IA generó una respuesta de texto directa.`);
        responseText = aiResponse.text;
      }

      // D. Persistir cambios de la sesión (historial con respuesta IA)
      console.log(`💾 Actualizando historial de chat con la respuesta de la IA...`);
      const updatedHistory = await aiResponse.chatSession.getHistory();
      await chatModel.saveHistory(phone, updatedHistory);

      // E. Enviar al cliente
      console.log(`📤 Enviando respuesta a WhatsApp...`);
      await whatsappService.sendMessage(phone, responseText);
      console.log(`💻 Respuesta enviada con éxito.`);

      // F. Notificar actualización final
      systemEvents.emit('lead_updated', { phone, type: 'ai_response' });
      console.log(`📡 Evento 'ai_response' emitido al Dashboard.`);

      return { status: 'ai_responded', text: responseText };

    } catch (error) {
      console.error(`🔥 Error en flujo de IA [${phone}]:`, error);
      const errorMsg = "Disculpa, tuve un pequeño problema técnico. ¿Podrías repetirme eso?";
      await whatsappService.sendMessage(phone, errorMsg);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Envía un mensaje manual desde el panel y pausa la IA
   */
  async sendManualMessage(phone, message) {
    // 1. Desactivar Bot para dar control al humano
    await leadModel.deactivateBot(phone);

    // 2. Enviar mensaje vía WhatsApp
    await whatsappService.sendMessage(phone, message);

    // 3. Registrar en historial como una nota del sistema
    await chatModel.addMessage(phone, {
      role: 'model',
      parts: [{ text: `[NOTA DEL SISTEMA: UN AGENTE HUMANO INTERVINO Y LE ENVIÓ EL SIGUIENTE MENSAJE AL CLIENTE]: "${message}"` }]
    });

    // 4. Notificar actualización
    systemEvents.emit('lead_updated', { phone, type: 'manual_message', bot_active: false });

    return { status: 'success', bot_deactivated: true };
  }

  /**
   * Cambia el estado del Bot (Activar/Desactivar)
   */
  async toggleBot(phone, active) {
    if (active) {
      await leadModel.activateBot(phone);
      const msg = "¡Listo! El asistente virtual está de nuevo a tu disposición. 🤖";
      await whatsappService.sendMessage(phone, msg);
      await chatModel.addMessage(phone, {
        role: 'model',
        parts: [{ text: `[NOTA DEL SISTEMA: SE REACTIVÓ A LA IA. EL SISTEMA ENVIÓ ESTE MENSAJE]: "${msg}"` }]
      });
    } else {
      await leadModel.deactivateBot(phone);
    }

    systemEvents.emit('lead_updated', { phone, type: 'bot_toggle', bot_active: active });
    return { status: 'success', bot_active: active };
  }
}

module.exports = new ConversationService();
