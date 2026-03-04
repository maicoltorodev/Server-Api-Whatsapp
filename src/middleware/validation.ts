import { z } from 'zod';
import logger, { securityLogger } from '../utils/logger';

// ==========================================
// API INPUT VALIDATION SCHEMAS
// ==========================================

export const WhatsAppWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      field: z.literal('messages'),
      value: z.object({
        messaging_product: z.literal('whatsapp'),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        contacts: z.array(z.object({
          wa_id: z.string().regex(/^\d+$/), // Solo números
          profile: z.object({
            name: z.string().min(1).max(50).optional(),
          }),
        })).optional(),
        messages: z.array(z.object({
          from: z.string().regex(/^\d+$/), // Solo números
          id: z.string(),
          timestamp: z.string().regex(/^\d+$/), // Timestamp numérico
          text: z.object({
            body: z.string().min(1).max(2000), // Limitar longitud
          }).optional(),
          type: z.enum(['text', 'image', 'audio', 'video', 'document']),
        })).optional(),
      }),
    })),
  })),
});

export const AdminAuthSchema = z.object({
  'x-api-key': z.string().min(10).max(100),
});

export const LeadUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  current_step: z.enum(['SALUDO', 'AGENDA', 'SERVICIOS', 'CONFIRMACION']).optional(),
  summary: z.string().min(1).max(500).optional(),
  bot_active: z.boolean().optional(),
});

export const AppointmentBookingSchema = z.object({
  service_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM
  notes: z.string().max(300).optional(),
});

// ==========================================
// VALIDATION MIDDLEWARE
// ==========================================

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      securityLogger.warn({
        errors: errorDetails,
        input: data,
      }, 'Input validation failed');

      throw new ValidationError('Invalid input data', errorDetails);
    }
    throw error;
  }
}

export class ValidationError extends Error {
  public readonly details: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  constructor(message: string, details: ValidationError['details']) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

// ==========================================
// SANITIZATION HELPERS
// ==========================================

export function sanitizePhoneNumber(phone: string): string {
  // Remover todo excepto números
  return phone.replace(/\D/g, '');
}

export function sanitizeString(input: string, maxLength: number = 1000): string {
  // Remover caracteres potencialmente peligrosos
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/[<>]/g, '') // Remove brackets
    .trim()
    .substring(0, maxLength);
}

export function validateWhatsAppMessage(message: string): string {
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

// ==========================================
// RATE LIMITING HELPERS
// ==========================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minuto
): boolean {
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
    securityLogger.warn({
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
