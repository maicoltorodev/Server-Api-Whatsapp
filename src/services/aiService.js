const { genAI, tools } = require('../config/ai');
const cacheManager = require('../utils/cache');
const config = require('../config');
const toolService = require('./toolService');

class AIService {
  constructor() {
    this.model = null;
  }

  /**
   * Inicializa el modelo con la instrucción de sistema dinámica
   */
  async initializeModel(leadData) {
    console.log(`   [IA] Inicializando modelo Flash 2.0...`);
    const currentTime = new Date().toLocaleString("es-CO", { timeZone: config.TIMEZONE });
    const currentStage = leadData?.current_step || 'SALUDO';
    const userSummary = leadData?.summary || 'Nuevo cliente.';
    const servicesCatalog = await cacheManager.getCatalog();
    console.log(`   [IA] Contexto: Etapa=${currentStage} | Resumen: ${userSummary.substring(0, 30)}...`);

    const systemInstruction = `Eres "Miel", la asistente virtual de "Pet Care Studio". 
    🗓️ HORA ACTUAL: ${currentTime}
    ESTADO CLIENTE: ${currentStage}. 
    RESUMEN CLIENTE: ${userSummary}.
    
    SERVICIOS DISPONIBLES:
    ${servicesCatalog}
    
    REGLAS:
    1. Sé concisa y amable. Usa Emojis 🐾.
    2. Disponibilidad/Citas -> Usa 'check_availability' y 'book_appointment'.
    3. Información de cliente -> Usa 'update_lead_info' frecuentemente para recordar nombres de mascotas, razas, etc.
    4. Traspaso humano -> Solo si el cliente lo pide o está frustrado, usa 'transfer_to_human'.`;

    this.model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", // Usando flash para velocidad
      tools: [tools],
      systemInstruction
    });
    console.log(`   [IA] Modelo listo.`);
  }

  /**
   * Alias para inicialización rápida
   */
  async prepareContext(leadData) {
    return await this.initializeModel(leadData);
  }

  /**
   * Genera una respuesta manejando el historial de forma segura
   */
  async generateResponse(message, history = []) {
    if (!this.model) throw new Error("IA no inicializada.");

    const sanitizedHistory = this._sanitizeHistory(history);
    console.log(`   [IA] Iniciando chat con historial sanitizado (${sanitizedHistory.length} msgs).`);

    const chatSession = this.model.startChat({
      history: sanitizedHistory
    });

    console.log(`   [IA] Enviando prompt: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    const result = await chatSession.sendMessage(message);

    const calls = result.response.functionCalls();
    if (calls && calls.length > 0) {
      console.log(`   [IA] Gemini respondió con CALL: ${calls.map(c => c.name).join(', ')}`);
    } else {
      console.log(`   [IA] Gemini respondió con TEXTO directamente.`);
    }

    return {
      functionCalls: calls,
      text: result.response.text(),
      chatSession
    };
  }

  /**
   * Orquesta la ejecución de herramientas y continúa la charla
   */
  async processFunctionCall(call, chatSession, phone) {
    const toolName = call.name;
    const args = call.args;

    // Ejecutar la lógica de la herramienta
    const toolResult = await toolService[toolName](args, phone);

    // Enviar el resultado de vuelta a la IA para que formule la respuesta final
    const result = await chatSession.sendMessage([{
      functionResponse: { name: toolName, response: toolResult }
    }]);

    return {
      text: result.response.text(),
      chatSession
    };
  }

  /**
   * Limpia el historial para cumplir con los requisitos de la API de Gemini
   */
  _sanitizeHistory(history) {
    if (history.length === 0) return [];

    // Gemini requiere que el historial empiece con 'user' y sea alternado
    let startIndex = 0;
    while (startIndex < history.length && history[startIndex].role !== 'user') {
      startIndex++;
    }

    return history.slice(startIndex).slice(-10); // Últimos 10 mensajes para contexto fresco
  }
}

module.exports = new AIService();
