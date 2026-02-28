/**
 * Funciones de validación para fechas, horas y otros datos
 */
const DateUtils = require('./DateUtils').default;

function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidTime(timeStr) {
  return /^\d{2}:\d{2}$/.test(timeStr);
}

function isFutureDate(dateStr) {
  if (!isValidDate(dateStr)) return false;

  const bogotaZeroToday = DateUtils.getBogotaZeroToday();
  const inputDate = DateUtils.createBogotaDate(dateStr);

  return inputDate.getTime() >= bogotaZeroToday.getTime();
}

function isFutureDateTime(dateStr, timeStr) {
  if (!isValidDate(dateStr) || !isValidTime(timeStr)) return false;

  const targetDate = DateUtils.createBogotaDate(dateStr, timeStr);
  const now = DateUtils.getNow();

  return targetDate.getTime() > now.getTime();
}

function isWithinBusinessHours(startTime, endTime, businessStart = '09:00', businessEnd = '17:00') {
  return startTime >= businessStart && endTime <= businessEnd;
}

function sanitizePhoneNumber(phone) {
  return phone.replace(/\D/g, '');
}

function isValidWhatsAppMessage(message) {
  return message && message.type === 'text' && message.text && message.text.body;
}

module.exports = {
  isValidDate,
  isValidTime,
  isFutureDate,
  isFutureDateTime,
  isWithinBusinessHours,
  sanitizePhoneNumber,
  isValidWhatsAppMessage,
};
