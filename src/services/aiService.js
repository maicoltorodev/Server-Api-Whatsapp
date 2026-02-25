const { genAI, tools } = require('../config/ai');
const cacheManager = require('../utils/cache');
const config = require('../config');

class AIService {
  constructor() {
    this.model = null;
  }

  /**
   * Inicializa el modelo de IA con el contexto actual
   */
  async initializeModel(currentStage, userSummary, servicesCatalog) {
    const currentTime = new Date().toLocaleString("es-CO", {
      timeZone: config.TIMEZONE
    });

    const systemInstruction = `Eres un asistente inteligente para "Pet Care Studio", un lujoso estudio de aseo canino. 
    🗓️ FECHA Y HORA ACTUAL DEL SISTEMA: ${currentTime}
    ESTADO ACTUAL DEL CLIENTE: ${currentStage}. 
    RESUMEN ACTUAL DE LA INFO DEL CLIENTE: ${userSummary}.
    
    NUESTRO CATÁLOGO DE SERVICIOS Y DURACIONES:
    ${servicesCatalog}
    
    REGLAS:
    1. Mantente amigable, cortés y persuasivo, pero conciso (es WhatsApp).
    2. Tienes acceso a la agenda: Si el cliente pregunta por disponibilidad, SIEMPRE usa la herramienta 'check_availability'.
    3. Si el cliente confirma querer una cita, SIEMPRE usa la herramienta 'book_appointment' para fijarla.
    4. Recopila poco a poco: nombre de mascota, raza y servicio deseado, pero de forma conversacional.
    5. Actualiza su estado general recurrentemente con 'update_lead_info'.
    6. Si está muy enojado o frustrado, o pide explicitamente un humano, usa 'transfer_to_human'.`;

    this.model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [tools],
      systemInstruction
    });
  }

  /**
   * Genera una respuesta de la IA
   */
  async generateResponse(message, history = []) {
    if (!this.model) {
      throw new Error("Model not initialized. Call initializeModel first.");
    }

    // Limitar historial para ahorrar tokens pero sin romper pares de "functionCall / functionResponse"
    let startIndex = Math.max(0, history.length - 15);

    // El historial DEBE empezar con un rol 'user' obligatoriamente.
    // Además, si caemos en un 'user' que es un `functionResponse`, nos faltará
    // su respectivo `functionCall` (del model) previo. 
    // Por eso, retrocedemos hasta encontrar un rol 'user' que NO sea una respuesta de función.
    while (
      startIndex > 0 &&
      (history[startIndex].role !== 'user' ||
        (history[startIndex].parts && history[startIndex].parts.some(p => p.functionResponse)))
    ) {
      startIndex--;
    }

    const limitedHistory = history.slice(startIndex);

    const chatSession = this.model.startChat({ history: limitedHistory });
    const result = await chatSession.sendMessage(message);

    return {
      response: result.response,
      functionCalls: result.response.functionCalls(),
      text: result.response.text(),
      chatSession
    };
  }

  /**
   * Continúa la conversación después de una function call
   */
  async continueConversation(chatSession, functionName, response) {
    const result = await chatSession.sendMessage([{
      functionResponse: { name: functionName, response }
    }]);

    return {
      text: result.response.text(),
      history: await chatSession.getHistory()
    };
  }

  /**
   * Prepara el contexto para la IA
   */
  async prepareContext(leadData) {
    const currentStage = leadData?.current_step || 'SALUDO';
    const userSummary = leadData?.summary || 'Nuevo cliente.';
    const servicesCatalog = await cacheManager.getCatalog();

    await this.initializeModel(currentStage, userSummary, servicesCatalog);

    return {
      currentStage,
      userSummary,
      servicesCatalog
    };
  }

  /**
   * Procesa las function calls de la IA
   */
  async processFunctionCall(call, chatSession, phone, leadData) {
    switch (call.name) {
      case "update_lead_info":
        return await this.handleUpdateLeadInfo(call.args, phone, leadData, chatSession);

      case "check_availability":
        return await this.handleCheckAvailability(call.args, chatSession);

      case "book_appointment":
        return await this.handleBookAppointment(call.args, phone, leadData, chatSession);

      case "cancel_appointment":
        return await this.handleCancelAppointment(call.args, phone, chatSession);

      case "transfer_to_human":
        return await this.handleTransferToHuman(phone, leadData, chatSession);

      default:
        throw new Error(`Unknown function call: ${call.name}`);
    }
  }

  /**
   * Maneja la actualización de información del lead
   */
  async handleUpdateLeadInfo(args, phone, leadData, chatSession) {
    const supabase = require('../config/database');

    // Evita sobrescribir el resumen existente
    const previousSummary = leadData?.summary || '';
    const newNotes = args.summary || '';
    const finalSummary = previousSummary && newNotes && !previousSummary.includes(newNotes)
      ? `${previousSummary} | ${newNotes}`
      : (newNotes || previousSummary);

    const updatePayload = { ...args, summary: finalSummary };

    const { error } = await supabase.from('leads').upsert({ phone, ...updatePayload }, { onConflict: 'phone' });

    if (error) {
      console.error(`🔥 BD Error (update_lead_info) [${phone}]:`, error.message);
      return await this.continueConversation(chatSession, "update_lead_info", { status: "error", message: "No se pudo guardar la información por un error interno." });
    }

    return await this.continueConversation(chatSession, "update_lead_info", { status: "ok" });
  }

  /**
   * Maneja la consulta de disponibilidad
   */
  async handleCheckAvailability(args, chatSession) {
    const appointmentService = require('./appointmentService');
    const availResult = await appointmentService.checkAvailability(args);

    return await this.continueConversation(chatSession, "check_availability", availResult);
  }

  /**
   * Maneja el agendamiento de citas
   */
  async handleBookAppointment(args, phone, leadData, chatSession) {
    const appointmentService = require('./appointmentService');
    const bookResult = await appointmentService.bookAppointment(phone, leadData, args);

    // Actualizar estado del lead a AGENDA
    const supabase = require('../config/database');
    const { error } = await supabase.from('leads').upsert({ phone, current_step: 'AGENDA' }, { onConflict: 'phone' });

    if (error) {
      console.error(`🔥 BD Error (book_appointment step update) [${phone}]:`, error.message);
      // We still return the original bookResult here, maybe inject the warning.
    } else {
      // Métrica de negocio: Conversión Exitosa
      if (bookResult.status === 'success') {
        console.info(JSON.stringify({
          metric: "conversion_ia_cita",
          phone: phone,
          timestamp: new Date().toISOString()
        }));
      }
    }

    return await this.continueConversation(chatSession, "book_appointment", bookResult);
  }

  /**
   * Maneja la cancelación de citas
   */
  async handleCancelAppointment(args, phone, chatSession) {
    const appointmentService = require('./appointmentService');
    const cancelResult = await appointmentService.cancelAppointment(phone, args);

    return await this.continueConversation(chatSession, "cancel_appointment", cancelResult);
  }

  /**
   * Maneja la transferencia a humano
   */
  async handleTransferToHuman(phone, leadData, chatSession) {
    console.log(`🚨 IA SOLICITA TRASPASO HUMANO`);

    const supabase = require('../config/database');
    const notificationService = require('./notificationService');

    const { error } = await supabase.from('leads').upsert({ phone, bot_active: false }, { onConflict: 'phone' });
    if (error) {
      console.error(`🔥 BD Error (transfer_to_human disable bot) [${phone}]:`, error.message);
    }

    // Métrica de negocio: Transferencia a Humano
    console.info(JSON.stringify({
      metric: "transferencia_humano",
      phone: phone,
      timestamp: new Date().toISOString()
    }));

    await notificationService.notifyOwner(phone, leadData?.name || "Cliente", "Solicitud de transferencia a humano");

    return {
      text: "Entiendo perfectamente. He pasado tu solicitud a un agente humano para que te atienda personalmente. Recibirás respuesta por aquí muy pronto.",
      history: await chatSession.getHistory()
    };
  }
}

module.exports = new AIService();
