/**
 * Utilidades Centralizadas para manejar la Zona Horaria de Bogotá (GMT-5)
 * Colombia no observa horario de verano (DST), por lo que el offset fijo de -5 horas es 100% seguro.
 */

export class DateUtils {
  public static readonly BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

  /**
   * Devuelve el instante actual global (Epoch absoluto).
   */
  public static getNow(): Date {
    return new Date();
  }

  /**
   * Devuelve una fecha "artificial" donde los métodos .getUTC* ()
   * devolverán la hora local de Bogotá.
   */
  public static getBogotaFakeUTC(date: Date = new Date()): Date {
    return new Date(date.getTime() + this.BOGOTA_OFFSET_MS);
  }

  /**
   * Devuelve un string con la fecha actual en la zona de Bogotá (YYYY-MM-DD).
   */
  public static getTodayBogotaStr(): string {
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
  public static createBogotaDate(dateStr: string, timeStr: string = '00:00:00'): Date {
    const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr.substring(0, 8);
    return new Date(`${dateStr}T${time}-05:00`);
  }

  /**
   * Obtiene el inicio del día (00:00:00) de hoy en Bogotá en un Epoch absoluto.
   */
  public static getBogotaZeroToday(): Date {
    return this.createBogotaDate(this.getTodayBogotaStr());
  }

  /**
   * Suma minutos a una fecha dada y retorna un nuevo Date absoluto.
   */
  public static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  /**
   * Devuelve la hora (HH:mm) en formato texto de un Date para la zona horaria de Bogotá.
   */
  public static getBogotaTimeString(date: Date): string {
    const bogota = this.getBogotaFakeUTC(date);
    const h = String(bogota.getUTCHours()).padStart(2, '0');
    const m = String(bogota.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

export default DateUtils;
