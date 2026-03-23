"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const memoryAdapter_1 = __importDefault(require("../core/memoryAdapter"));
class ToolService {
    /**
     * Herramienta 1: Actualiza preferencias en el perfil del usuario (Mock DB)
     */
    async save_user_preference(args, phone) {
        try {
            const { category, value } = args;
            if (!category || !value) {
                return { status: 'error', message: 'Faltan parámetros requeridos (category, value).' };
            }
            // Guardamos la preferencia en nuestro adaptador en memoria
            await memoryAdapter_1.default.savePreference(phone, category, value);
            logger_1.default.info(`[TOOL] Preferencia guardada para ${phone}: ${category} = ${value}`);
            return { status: 'ok', message: `Preferencia '${category}' guardada exitosamente.` };
        }
        catch (error) {
            logger_1.default.error(`[TOOL] Error guardando preferencia`, { error });
            return { status: 'error', message: 'Error interno guardando la preferencia.' };
        }
    }
    /**
     * Herramienta 1.5: Actualiza el estado del pedido completo (FSM)
     */
    async update_user_state(args, phone) {
        try {
            const { producto, tiene_diseno, tamano, fase } = args;
            if (producto !== undefined)
                await memoryAdapter_1.default.savePreference(phone, 'producto', producto);
            if (tiene_diseno !== undefined)
                await memoryAdapter_1.default.savePreference(phone, 'tiene_diseno', String(tiene_diseno));
            if (tamano !== undefined)
                await memoryAdapter_1.default.savePreference(phone, 'tamano', tamano);
            if (fase !== undefined)
                await memoryAdapter_1.default.savePreference(phone, 'fase', fase);
            logger_1.default.info(`[TOOL] Estado de usuario actualizado para ${phone}`, args);
            return { status: 'ok', message: 'Estado del pedido actualizado correctamente.' };
        }
        catch (error) {
            logger_1.default.error(`[TOOL] Error actualizando estado`, { error });
            return { status: 'error', message: 'Error interno actualizando el estado.' };
        }
    }
    /**
     * Herramienta 2: Solicita intervención humana
     */
    async transfer_to_human(args, phone) {
        try {
            const { reason } = args;
            // Actualizamos la etapa del lead en el CRM para que el bot lo ignore en el futuro
            await memoryAdapter_1.default.updateUser(phone, { stage: 'DERIVADO_A_HUMANO' });
            logger_1.default.warn(`[TOOL] Transferencia a humano solicitada para ${phone}. Razón: ${reason}`);
            // Aquí podrías disparar un email, enviar mensaje a Slack, etc.
            return {
                status: 'transferred',
                message: 'Se ha notificado a un agente humano. El bot ha sido pausado para este chat.',
            };
        }
        catch (error) {
            logger_1.default.error(`[TOOL] Error transfiriendo a humano`, { error });
            return { status: 'error', message: 'Error al solicitar transferencia a humano.' };
        }
    }
}
exports.ToolService = ToolService;
exports.default = new ToolService();
