import supabase from '../config/database';
import logger from '../utils/logger';

export class SystemLogModel {
    /**
     * Persiste un log directamente en la base de datos para auditoría o errores críticos
     */
    public async log(level: 'error' | 'warn' | 'info' | 'ERROR' | 'WARN' | 'INFO', message: string, phone: string | null = null, context: any = null, stack: string | null = null) {
        const normalizedLevel = level.toUpperCase();
        const { error } = await supabase
            .from('system_logs')
            .insert({
                level: normalizedLevel,
                message,
                phone,
                context: context ? JSON.stringify(context) : null,
                stack
            });

        if (error) {
            // Si falla el log en DB, al menos que quede en consola
            logger.error('Fallo al persistir log en Base de Datos:', { error, originalMessage: message });
        }
    }

    /**
     * Atajo para log de error persistente
     */
    public async logError(phone: string | null, message: string, errorObj: any) {
        return this.log(
            'error',
            message,
            phone,
            errorObj?.context || null,
            errorObj?.stack || errorObj?.message || null
        );
    }
}

export default new SystemLogModel();

