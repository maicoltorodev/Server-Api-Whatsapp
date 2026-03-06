/**
 * Funciones de validación para fechas, horas y otros datos
 */
import DateUtils from './DateUtils';

export function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

export function isValidTime(timeStr: string): boolean {
  return /^\d{2}:\d{2}$/.test(timeStr);
}

export function isFutureDate(dateStr: string): boolean {
  if (!isValidDate(dateStr)) return false;

  const bogotaZeroToday = DateUtils.getBogotaZeroToday();
  const inputDate = DateUtils.createBogotaDate(dateStr);

  return inputDate.getTime() >= bogotaZeroToday.getTime();
}

export function isFutureDateTime(dateStr: string, timeStr: string): boolean {
  if (!isValidDate(dateStr) || !isValidTime(timeStr)) return false;

  const targetDate = DateUtils.createBogotaDate(dateStr, timeStr);
  const now = DateUtils.getNow();

  return targetDate.getTime() > now.getTime();
}

export function isWithinBusinessHours(startTime: string, endTime: string, businessStart = '09:00', businessEnd = '17:00'): boolean {
  return startTime >= businessStart && endTime <= businessEnd;
}

export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidWhatsAppMessage(message: any): boolean {
  return message && message.type === 'text' && message.text && message.text.body;
}

export default {
  isValidDate,
  isValidTime,
  isFutureDate,
  isFutureDateTime,
  isWithinBusinessHours,
  sanitizePhoneNumber,
  isValidWhatsAppMessage,
};

