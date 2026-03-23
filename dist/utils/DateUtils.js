"use strict";
/**
 * Utilidades Centralizadas para manejar la Zona Horaria de Bogotá (GMT-5)
 * Colombia no observa horario de verano (DST), por lo que el offset fijo de -5 horas es 100% seguro.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateUtils = void 0;
class DateUtils {
    static BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
    /**
     * Devuelve el instante actual global (Epoch absoluto).
     */
    static getNow() {
        return new Date();
    }
    /**
     * Devuelve una fecha "artificial" donde los métodos .getUTC* ()
     * devolverán la hora local de Bogotá.
     */
    static getBogotaFakeUTC(date = new Date()) {
        return new Date(date.getTime() + this.BOGOTA_OFFSET_MS);
    }
    /**
     * Devuelve un string con la fecha actual en la zona de Bogotá (YYYY-MM-DD).
     */
    static getTodayBogotaStr() {
        const bogota = this.getBogotaFakeUTC();
        const year = bogota.getUTCFullYear();
        const month = String(bogota.getUTCMonth() + 1).padStart(2, '0');
        const day = String(bogota.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * Crea un objeto Date absoluto a partir de una fecha y hora local de Bogotá.
     * @param dateStr Formato YYYY-MM-DD
     * @param timeStr Formato HH:mm o HH:mm:ss (Opcional, default 00:00:00)
     */
    static createBogotaDate(dateStr, timeStr = '00:00:00') {
        const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr.substring(0, 8);
        return new Date(`${dateStr}T${time}-05:00`);
    }
    /**
     * Obtiene el inicio del día (00:00:00) de hoy en Bogotá en un Epoch absoluto.
     */
    static getBogotaZeroToday() {
        return this.createBogotaDate(this.getTodayBogotaStr());
    }
    /**
     * Suma minutos a una fecha dada y retorna un nuevo Date absoluto.
     */
    static addMinutes(date, minutes) {
        return new Date(date.getTime() + minutes * 60 * 1000);
    }
    /**
     * Devuelve la hora (HH:mm) en formato texto de un Date para la zona horaria de Bogotá.
     */
    static getBogotaTimeString(date) {
        const bogota = this.getBogotaFakeUTC(date);
        const h = String(bogota.getUTCHours()).padStart(2, '0');
        const m = String(bogota.getUTCMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }
}
exports.DateUtils = DateUtils;
exports.default = DateUtils;
