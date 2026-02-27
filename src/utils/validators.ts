/**
 * Funciones de validación para fechas, horas y otros datos
 */

function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function isValidTime(timeStr) {
  return /^\d{2}:\d{2}$/.test(timeStr);
}

function isFutureDate(dateStr) {
  if (!isValidDate(dateStr)) return false;

  const now = new Date(); // Instante UTC absoluto
  // Lo forzamos a 00:00 del día actual en sudamérica (GMT-5). Restamos 5 hrs.
  const bogotaZero = new Date(now.getTime() - (5 * 60 * 60 * 1000));
  bogotaZero.setUTCHours(0, 0, 0, 0);

  // Parseamos el input simulando que también es UTC a las 00:00 para alinear peras con peras
  const inputDate = new Date(`${dateStr}T00:00:00Z`);

  return inputDate.getTime() >= bogotaZero.getTime();
}

function isFutureDateTime(dateStr, timeStr) {
  if (!isValidDate(dateStr) || !isValidTime(timeStr)) return false;

  // Al crear targetDate con -05:00, JS genera el timestamp Epoch correcto al instante absoluto de la línea del tiempo.
  const targetDate = new Date(`${dateStr}T${timeStr}:00-05:00`);
  const now = new Date(); // Timestamp Epoch instantáneo real, sin importar en qué servidor esté.

  return targetDate.getTime() > now.getTime();
}

function isWithinBusinessHours(startTime, endTime, businessStart = "09:00", businessEnd = "17:00") {
  return startTime >= businessStart && endTime <= businessEnd;
}

function sanitizePhoneNumber(phone) {
  return phone.replace(/\D/g, '');
}

function isValidWhatsAppMessage(message) {
  return message &&
    message.type === 'text' &&
    message.text &&
    message.text.body;
}

module.exports = {
  isValidDate,
  isValidTime,
  isFutureDate,
  isFutureDateTime,
  isWithinBusinessHours,
  sanitizePhoneNumber,
  isValidWhatsAppMessage
};
