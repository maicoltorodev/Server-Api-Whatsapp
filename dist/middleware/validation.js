"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = exports.AppointmentBookingSchema = exports.LeadUpdateSchema = exports.AdminAuthSchema = exports.WhatsAppWebhookSchema = void 0;
exports.validateInput = validateInput;
exports.sanitizePhoneNumber = sanitizePhoneNumber;
exports.sanitizeString = sanitizeString;
exports.validateWhatsAppMessage = validateWhatsAppMessage;
exports.checkRateLimit = checkRateLimit;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
// ==========================================
// API INPUT VALIDATION SCHEMAS
// ==========================================
exports.WhatsAppWebhookSchema = zod_1.z.object({
    object: zod_1.z.literal('whatsapp_business_account'),
    entry: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        changes: zod_1.z.array(zod_1.z.object({
            field: zod_1.z.literal('messages'),
            value: zod_1.z.object({
                messaging_product: zod_1.z.literal('whatsapp'),
                metadata: zod_1.z.object({
                    display_phone_number: zod_1.z.string(),
                    phone_number_id: zod_1.z.string(),
                }),
                contacts: zod_1.z.array(zod_1.z.object({
                    wa_id: zod_1.z.string().regex(/^\d+$/), // Solo números
                    profile: zod_1.z.object({
                        name: zod_1.z.string().min(1).max(50).optional(),
                    }),
                })).optional(),
                messages: zod_1.z.array(zod_1.z.object({
                    from: zod_1.z.string().regex(/^\d+$/), // Solo números
                    id: zod_1.z.string(),
                    timestamp: zod_1.z.string().regex(/^\d+$/), // Timestamp numérico
                    text: zod_1.z.object({
                        body: zod_1.z.string().min(1).max(2000), // Limitar longitud
                    }).optional(),
                    type: zod_1.z.enum(['text', 'image', 'audio', 'video', 'document']),
                })).optional(),
            }),
        })),
    })),
});
exports.AdminAuthSchema = zod_1.z.object({
    'x-api-key': zod_1.z.string().min(10).max(100),
});
exports.LeadUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    current_step: zod_1.z.enum(['SALUDO', 'AGENDA', 'SERVICIOS', 'CONFIRMACION']).optional(),
    summary: zod_1.z.string().min(1).max(500).optional(),
    bot_active: zod_1.z.boolean().optional(),
});
exports.AppointmentBookingSchema = zod_1.z.object({
    service_id: zod_1.z.string().min(1),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    time: zod_1.z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
    notes: zod_1.z.string().max(300).optional(),
});
// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================
function validateInput(schema, data) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const errorDetails = error.issues.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
            }));
            logger_1.securityLogger.warn({
                errors: errorDetails,
                input: data,
            }, 'Input validation failed');
            throw new ValidationError('Invalid input data', errorDetails);
        }
        throw error;
    }
}
class ValidationError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
    }
}
exports.ValidationError = ValidationError;
// ==========================================
// SANITIZATION HELPERS
// ==========================================
function sanitizePhoneNumber(phone) {
    // Remover todo excepto números
    return phone.replace(/\D/g, '');
}
function sanitizeString(input, maxLength = 1000) {
    // Remover caracteres potencialmente peligrosos
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/[<>]/g, '') // Remove brackets
        .trim()
        .substring(0, maxLength);
}
function validateWhatsAppMessage(message) {
    const sanitized = sanitizeString(message, 2000);
    // Validaciones específicas para WhatsApp
    if (sanitized.length === 0) {
        throw new ValidationError('Message cannot be empty', []);
    }
    if (sanitized.length > 2000) {
        throw new ValidationError('Message too long', []);
    }
    return sanitized;
}
const rateLimitStore = new Map();
function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000 // 1 minuto
) {
    const now = Date.now();
    const entry = rateLimitStore.get(identifier);
    if (!entry || now > entry.resetTime) {
        // Nueva ventana o ventana expirada
        rateLimitStore.set(identifier, {
            count: 1,
            resetTime: now + windowMs,
        });
        return true;
    }
    if (entry.count >= maxRequests) {
        logger_1.securityLogger.warn({
            identifier,
            count: entry.count,
            maxRequests,
            windowMs,
        }, 'Rate limit exceeded');
        return false;
    }
    entry.count++;
    return true;
}
// Limpieza periódica de entradas expiradas
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 300000); // Limpiar cada 5 minutos
