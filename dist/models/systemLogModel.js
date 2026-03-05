"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase = require('../config/database');
const logger = require('../utils/logger').default;
class SystemLogModel {
    /**
     * Persiste un log directamente en la base de datos para auditoría o errores críticos
     */
    async log(level, message, phone = null, context = null, stack = null) {
        const { error } = await supabase
            .from('system_logs')
            .insert({
            level,
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
    async logError(phone, message, errorObj) {
        return this.log('error', message, phone, errorObj?.context || null, errorObj?.stack || errorObj?.message || null);
    }
}
module.exports = new SystemLogModel();
