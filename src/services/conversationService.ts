import MemoryAdapter from '../core/memoryAdapter';
import aiService from './aiService';
import whatsappService from './whatsappService';
import logger from '../utils/logger';

export class ConversationService {
  /**
   * Procesa un mensaje entrante de un cliente de principio a fin
   */
  public async handleIncomingMessage(phone: string, message: string, media: any[] = [], lastMsgId?: string) {
    logger.info(`🤖 [ORQUESTADOR] Iniciando proceso para: ${phone} | Media: ${media.length}`);

    // 1. Obtener o crear Usuario en Memoria (Mock CRM)
    let user = await MemoryAdapter.getUser(phone);
    if (!user) {
      user = await MemoryAdapter.createUser(phone, 'Usuario ' + phone.slice(-4));
    } else {
      await MemoryAdapter.updateUser(phone, { lastInteraction: new Date() });
    }

    // 2. Obtener historial para alimentar a Gemini (No guardamos el nuevo mensaje aún)
    const pastHistory = await MemoryAdapter.getHistory(phone);

    // 3. Verificar si el bot debe responder (Etapas)
    if (user.stage === 'DERIVADO_A_HUMANO') {
      logger.warn(`  ↳ Bot en PAUSA para ${phone}. El humano tiene el control.`);
      // Opcional: Notificar al humano en Slack, Mail, etc.
      return { status: 'human_control' };
    }

    // 4. Activar Indicador de Escritura
    const typingStartedAt = Date.now();
    await whatsappService.sendTypingIndicator(phone, lastMsgId);

    // 5. Procesar con IA
    try {
      const hasMedia = media && media.length > 0;
      const model = await aiService.initializeModel(user, hasMedia);

      const aiResponse = await aiService.generateResponse(model, message, pastHistory, media);
      let responseText = '';

      if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
        logger.info(`La IA solicitó ejecutar herramientas: ${aiResponse.functionCalls.map((c: any) => c.name).join(', ')}`);
        
        const result = await aiService.processFunctionCalls(
          aiResponse.functionCalls,
          aiResponse.chatSession,
          phone
        );
        responseText = result.text;
      } else {
        responseText = aiResponse.text;
      }

      // --- 🧠 EXTRAER RESUMEN DE MULTIMEDIA (Si existe) ---
      let finalUserMessage = message; 

      if (hasMedia && responseText) {
        const match = responseText.match(/^\[(RESUMEN:\s*(.*?))\]\s*\n?/i);
        if (match) {
          finalUserMessage = `[${match[1]}]`; // Guardamos el resumen descriptivo
          responseText = responseText.replace(match[0], '').trim(); // Removemos para el cliente
          logger.info(`📸 [MULTIMEDIA RESUMEN EXTRACTO]: ${finalUserMessage}`);
        }
      }

      // Guardamos ahora sí el mensaje del usuario con su resumen
      await MemoryAdapter.saveMessage(phone, 'user', finalUserMessage);

      // Validación de fallos
      if (!responseText || responseText.trim() === '') {
        logger.warn(`[FALLO IA] No generó texto. Pasando a manual.`);
        await MemoryAdapter.updateUser(phone, { stage: 'DERIVADO_A_HUMANO' });
        return { status: 'error_no_text' };
      }

      // Guardar en la DB simulada
      await MemoryAdapter.saveMessage(phone, 'model', responseText);
      logger.info(`[IA - RESPUESTA FINAL]: "${responseText}"`);

      // Timear la respuesta para simular escritura humana
      const targetTypingDuration = Math.min(1000 + responseText.length * 10, 4000); 
      const elapsed = Date.now() - typingStartedAt;
      const remainingTypingTime = Math.max(0, targetTypingDuration - elapsed);

      if (remainingTypingTime > 0) {
         await new Promise(resolve => setTimeout(resolve, remainingTypingTime));
      }

      // Enviar a WhatsApp!
      await whatsappService.sendMessage(phone, responseText);
      
      return { status: 'ai_responded' };

    } catch (error: any) {
       logger.error(`❌ [ERROR - IA] Error en flujo de IA [${phone}]`, { error: error.message });
       await MemoryAdapter.updateUser(phone, { stage: 'DERIVADO_A_HUMANO' });
       await whatsappService.sendMessage(phone, "Disculpa, hubo un problema técnico. Te comunicaré con un humano.");
       return { status: 'error', error: error.message };
    }
  }
}

export default new ConversationService();
