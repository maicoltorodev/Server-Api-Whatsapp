"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { genAI, tools } = require('../config/ai');
const cacheManager = require('../utils/cache');
const config = require('../config');
const toolService = require('./toolService');
const logger = require('../utils/logger').default;
class AIService {
    model;
    constructor() {
        this.model = null;
    }
    /**
     * Inicializa el modelo con la instrucción de sistema dinámica
     */
    async initializeModel(leadData) {
        logger.info(`[IA] Inicializando modelo Flash (Latest)...`);
        const currentTime = new Date().toLocaleString("es-CO", { timeZone: config.TIMEZONE });
        const currentStage = leadData?.current_step || 'SALUDO';
        const userSummary = leadData?.summary || 'Nuevo cliente.';
        // Parsear stringificación del JSONB si es necesario
        let medicalHistory = 'Ninguno registrado aún.';
        if (leadData?.medical_history) {
            if (leadData.medical_history.pets) {
                medicalHistory = leadData.medical_history.pets.map(p => `🐾 MASCOTA: ${p.name}\n- Alergias: ${p.allergies?.join(', ') || 'Ninguna'}\n- Conducta: ${p.behavior || 'N/A'}\n- Preferencias: ${p.preferences?.join(', ') || 'N/A'}`).join('\n\n');
            }
            else {
                // Fallback para datos antiguos o flat
                medicalHistory = JSON.stringify(leadData.medical_history, null, 2);
            }
        }
        const servicesCatalog = await cacheManager.getCatalog();
        const agendaConfig = await cacheManager.getAgendaConfig();
        logger.info(`[IA] Contexto: Etapa=${currentStage} | Resumen: ${userSummary.substring(0, 30)}...`);
        const systemInstruction = `Eres "${agendaConfig.agentName || 'Asistente'}", la asistente virtual de "${agendaConfig.siteName || 'Pet Care Studio'}". 
    PERSONALIDAD: ${agendaConfig.agentPersonality || 'Amigable, profesional y apasionada por las mascotas.'}
    
    🗓️ HORA ACTUAL: ${currentTime}
    ESTADO CLIENTE: ${currentStage}. 
    RESUMEN RECIENTE (Chat Corto Plazo): ${userSummary}.

    🧠 FICHAS CLÍNICAS (Memoria a Largo Plazo):
    En este apartado verás la información de las mascotas del cliente. Un cliente puede tener varias mascotas.
    ${medicalHistory}
    (Usa OBLIGATORIAMENTE esta información clínica antes de ofrecer servicios para cada mascota específica).

    
    SERVICIOS DISPONIBLES:
    ${servicesCatalog}
    
    HORARIOS DE ATENCIÓN:
    ${agendaConfig.business_hours_text || '- Lunes a Sábado: 09:00 AM a 05:00 PM (17:00).'}
    ${agendaConfig.closed_days_text ? `\nDÍAS CERRADOS:\n${agendaConfig.closed_days_text}` : '\n- Domingos: Cerrado.'}
    
    REGLAS DE NEGOCIO EN EL ESTUDIO:
    ${agendaConfig.businessRules || 'Tratar a cada mascota con amor.'}
    
    INSTRUCCIONES MAESTRAS:
    ${agendaConfig.masterPrompt || 'Tu objetivo es ayudar al cliente a agendar citas y resolver dudas. Sé concisa y amable.'}

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
        logger.info(`[IA] Modelo listo.`);
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
        if (!this.model)
            throw new Error("IA no inicializada.");
        const sanitizedHistory = this._sanitizeHistory(history);
        logger.info(`[IA] Iniciando chat con historial sanitizado (${sanitizedHistory.length} msgs).`);
        const chatSession = this.model.startChat({
            history: sanitizedHistory
        });
        logger.info(`[IA] Enviando prompt: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
        let result;
        try {
            logger.info("[DEBUG] Ejecutando chatSession.sendMessage...");
            result = await Promise.race([
                chatSession.sendMessage(message),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de 20s en Gemini API")), 20000))
            ]);
            logger.info("[DEBUG] chatSession.sendMessage finalizado con éxito.");
        }
        catch (apiError) {
            logger.error(`[IA] Error en Gemini API durante sendMessage: ${apiError.message}`, { error: apiError });
            throw apiError;
        }
        const usage = result?.response?.usageMetadata;
        if (usage) {
            logger.info(`[IA] Tokens: Prompt=${usage.promptTokenCount} | Respuesta=${usage.candidatesTokenCount} | Total=${usage.totalTokenCount}`);
        }
        const calls = result.response.functionCalls();
        if (calls && calls.length > 0) {
            logger.info(`[IA] Gemini respondió con CALL: ${calls.map(c => c.name).join(', ')}`);
        }
        else {
            logger.info(`[IA] Gemini respondió con TEXTO directamente.`);
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
                logger.info(`[TOOL] Executing: ${toolName} para ${phone}`);
                try {
                    const toolResult = await toolService[toolName](args, phone);
                    toolResponses.push({
                        functionResponse: { name: toolName, response: toolResult }
                    });
                }
                catch (error) {
                    logger.error(`[TOOL] Error fatal en ${toolName}`, { error });
                    toolResponses.push({
                        functionResponse: { name: toolName, response: { status: "error", message: "Error interno ejecutando herramienta." } }
                    });
                }
            }
            // Enviar todos los resultados de una vez
            const result = await chatSession.sendMessage(toolResponses);
            const usage = result.response.usageMetadata;
            if (usage) {
                logger.info(`[IA] Tokens (Herramienta): Prompt=${usage.promptTokenCount} | Respuesta=${usage.candidatesTokenCount} | Total=${usage.totalTokenCount}`);
            }
            finalResponse.text = result.response.text();
            currentCalls = result.response.functionCalls();
            if (currentCalls && currentCalls.length > 0) {
                logger.info(`[IA] Gemini pidió más llamadas: ${currentCalls.map(c => c.name).join(', ')}`);
            }
        }
        return finalResponse;
    }
    _sanitizeHistory(history) {
        if (history.length === 0)
            return [];
        let sanitized = [...history];
        // 1. Quitar el último si es del usuario (porque se enviará en el prompt actual)
        if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
            logger.info(`[IA] Historial ajustado: quitando último mensaje 'user' para evitar duplicidad.`);
            sanitized.pop();
        }
        // 2. Limitar tamaño
        const MAX_HISTORY = 12;
        if (sanitized.length > MAX_HISTORY) {
            sanitized = sanitized.slice(-MAX_HISTORY);
        }
        // Asegurar que el primer mensaje sea 'user'
        let sliceIndex = 0;
        while (sliceIndex < sanitized.length && sanitized[sliceIndex].role !== 'user') {
            sliceIndex++;
        }
        const finalHistory = sanitized.slice(sliceIndex);
        // 3. Verificación de alternancia Gemini (user, model, user, model...)
        const alternatingHistory = [];
        for (const msg of finalHistory) {
            if (alternatingHistory.length > 0 && alternatingHistory[alternatingHistory.length - 1].role === msg.role) {
                if (msg.role === 'user' && msg.parts && msg.parts[0] && msg.parts[0].text) {
                    alternatingHistory[alternatingHistory.length - 1].parts[0].text += " " + msg.parts[0].text;
                }
            }
            else {
                alternatingHistory.push(msg);
            }
        }
        return alternatingHistory;
    }
}
module.exports = new AIService();
