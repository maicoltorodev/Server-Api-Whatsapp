import logger from '../utils/logger';
import MemoryAdapter from '../core/memoryAdapter';

export class ToolService {
  /**
   * Herramienta 1: Actualiza preferencias en el perfil del usuario (Mock DB)
   */
  public async save_user_preference(args: any, phone: string) {
    try {
      const { category, value } = args;
      if (!category || !value) {
        return { status: 'error', message: 'Faltan parámetros requeridos (category, value).' };
      }

      // Guardamos la preferencia en nuestro adaptador en memoria
      await MemoryAdapter.savePreference(phone, category, value);
      
      logger.info(`[TOOL] Preferencia guardada para ${phone}: ${category} = ${value}`);
      return { status: 'ok', message: `Preferencia '${category}' guardada exitosamente.` };
    } catch (error: any) {
      logger.error(`[TOOL] Error guardando preferencia`, { error });
      return { status: 'error', message: 'Error interno guardando la preferencia.' };
    }
  }

  /**
   * Herramienta 1.5: Actualiza el estado del pedido completo (FSM)
   */
  public async update_user_state(args: any, phone: string) {
    try {
      const { producto, tiene_diseno, tamano, fase } = args;
      
      if (producto !== undefined) await MemoryAdapter.savePreference(phone, 'producto', producto);
      if (tiene_diseno !== undefined) await MemoryAdapter.savePreference(phone, 'tiene_diseno', String(tiene_diseno));
      if (tamano !== undefined) await MemoryAdapter.savePreference(phone, 'tamano', tamano);
      if (fase !== undefined) await MemoryAdapter.savePreference(phone, 'fase', fase);
      
      logger.info(`[TOOL] Estado de usuario actualizado para ${phone}`, args);
      return { status: 'ok', message: 'Estado del pedido actualizado correctamente.' };
    } catch (error: any) {
      logger.error(`[TOOL] Error actualizando estado`, { error });
      return { status: 'error', message: 'Error interno actualizando el estado.' };
    }
  }

  /**
   * Herramienta 2: Solicita intervención humana
   */
  public async transfer_to_human(args: any, phone: string) {
    try {
      const { reason } = args;
      
      // Actualizamos la etapa del lead en el CRM para que el bot lo ignore en el futuro
      await MemoryAdapter.updateUser(phone, { stage: 'DERIVADO_A_HUMANO' });
      
      logger.warn(`[TOOL] Transferencia a humano solicitada para ${phone}. Razón: ${reason}`);

      // Aquí podrías disparar un email, enviar mensaje a Slack, etc.
      return {
        status: 'transferred',
        message: 'Se ha notificado a un agente humano. El bot ha sido pausado para este chat.',
      };
    } catch (error: any) {
       logger.error(`[TOOL] Error transfiriendo a humano`, { error });
       return { status: 'error', message: 'Error al solicitar transferencia a humano.' };
    }
  }

  // Agrega aquí más herramientas que declares en botConfig.ts...
}

export default new ToolService();
