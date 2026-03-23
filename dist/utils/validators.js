"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidDate = isValidDate;
exports.isValidTime = isValidTime;
exports.isFutureDate = isFutureDate;
exports.isFutureDateTime = isFutureDateTime;
exports.isWithinBusinessHours = isWithinBusinessHours;
exports.sanitizePhoneNumber = sanitizePhoneNumber;
exports.isValidWhatsAppMessage = isValidWhatsAppMessage;
/**
 * Funciones de validación para fechas, horas y otros datos
 */
const DateUtils_1 = __importDefault(require("./DateUtils"));
function isValidDate(dateStr) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}
function isValidTime(timeStr) {
    return /^\d{2}:\d{2}$/.test(timeStr);
}
function isFutureDate(dateStr) {
    if (!isValidDate(dateStr))
        return false;
    const bogotaZeroToday = DateUtils_1.default.getBogotaZeroToday();
    const inputDate = DateUtils_1.default.createBogotaDate(dateStr);
    return inputDate.getTime() >= bogotaZeroToday.getTime();
}
function isFutureDateTime(dateStr, timeStr) {
    if (!isValidDate(dateStr) || !isValidTime(timeStr))
        return false;
    const targetDate = DateUtils_1.default.createBogotaDate(dateStr, timeStr);
    const now = DateUtils_1.default.getNow();
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
exports.default = {
    isValidDate,
    isValidTime,
    isFutureDate,
    isFutureDateTime,
    isWithinBusinessHours,
    sanitizePhoneNumber,
    isValidWhatsAppMessage,
};
