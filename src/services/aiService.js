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
    console.log(`   [IA] Inicializando modelo Flash (Latest)...`);
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
    
    REGLAS DE ORO (OBLIGATORIAS):
    1. PROHIBIDO decir "Déjame revisar", "Dame un momento", "Ya te confirmo" o similares. Tienes acceso instantáneo a la agenda.
    2. Si necesitas verificar algo (como disponibilidad), ejecuta 'check_availability' DE INMEDIATO y responde directamente con el resultado que recibas.
    3. Nunca des una respuesta de texto que prometa una acción futura; realiza la acción AHORA usando las herramientas.
    4. Sé concisa y amable. Usa Emojis 🐾.
    5. Citas -> Usa 'check_availability' para ver huecos y 'book_appointment' SOLO cuando el cliente acepte un horario específico.
    6. Traspaso humano -> Solo si el cliente lo pide o está frustrado, usa 'transfer_to_human'.`;

    this.model = genAI.getGenerativeModel({
      model: "gemini-flash-latest", // Alias dinámico al mejor flash disponible
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

    const usage = result.response.usageMetadata;
    if (usage) {
      console.log(`   [IA] Tokens: Prompt=${usage.promptTokenCount} | Respuesta=${usage.candidatesTokenCount} | Total=${usage.totalTokenCount}`);
    }

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
   * Orquesta la ejecución de varias herramientas en bucle hasta obtener texto
   */
  async processFunctionCalls(calls, chatSession, phone) {
    let currentCalls = calls;
    let finalResponse = { text: "", chatSession };

    // Bucle para manejar function calls anidados o múltiples
    while (currentCalls && currentCalls.length > 0) {
      const toolResponses = [];

      for (const call of currentCalls) {
        const toolName = call.name;
        const args = call.args;
        console.log(`   [TOOL] Executing: ${toolName} para ${phone}`);

        try {
          const toolResult = await toolService[toolName](args, phone);
          toolResponses.push({
            functionResponse: { name: toolName, response: toolResult }
          });
        } catch (error) {
          console.error(`   [TOOL] Error fatal en ${toolName}:`, error.message);
          toolResponses.push({
            functionResponse: { name: toolName, response: { status: "error", message: "Error interno ejecutando herramienta." } }
          });
        }
      }

      // Enviar todos los resultados de una vez
      const result = await chatSession.sendMessage(toolResponses);

      const usage = result.response.usageMetadata;
      if (usage) {
        console.log(`   [IA] Tokens (Herramienta): Prompt=${usage.promptTokenCount} | Respuesta=${usage.candidatesTokenCount} | Total=${usage.totalTokenCount}`);
      }

      finalResponse.text = result.response.text();
      currentCalls = result.response.functionCalls();

      if (currentCalls && currentCalls.length > 0) {
        console.log(`   [IA] Gemini pidió más llamadas: ${currentCalls.map(c => c.name).join(', ')}`);
      }
    }

    return finalResponse;
  }

  _sanitizeHistory(history) {
    if (history.length === 0) return [];

    let sanitized = [...history];

    // 1. Quitar el último si es del usuario (porque se enviará en el prompt actual)
    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
      console.log(`   [IA] Historial ajustado: quitando último mensaje 'user' para evitar duplicidad.`);
      sanitized.pop();
    }

    // 2. Limitar tamaño pero asegurando que SIEMPRE empiece con 'user' y 
    // no rompa bloques de functionCall (que son model -> user/functionResponse)
    const MAX_HISTORY = 12;
    if (sanitized.length > MAX_HISTORY) {
      sanitized = sanitized.slice(-MAX_HISTORY);
    }

    // Asegurar que el primer mensaje del historial sea 'user'
    while (sanitized.length > 0 && sanitized[0].role !== 'user') {
      sanitized.shift();
    }

    // 3. Verificación de alternancia Gemini (user, model, user, model...)
    // Si hay dos mensajes seguidos del mismo rol, Gemini fallará.
    const finalHistory = [];
    for (const msg of sanitized) {
      if (finalHistory.length > 0 && finalHistory[finalHistory.length - 1].role === msg.role) {
        // Si hay duplicado de rol, fusionamos el texto o ignoramos
        console.log(`   [IA] Sanitización: Fusionando mensajes duplicados de rol ${msg.role}`);
        if (msg.parts && msg.parts[0] && msg.parts[0].text) {
          finalHistory[finalHistory.length - 1].parts[0].text += " " + msg.parts[0].text;
        }
      } else {
        finalHistory.push(msg);
      }
    }

    return finalHistory;
  }
}

module.exports = new AIService();
