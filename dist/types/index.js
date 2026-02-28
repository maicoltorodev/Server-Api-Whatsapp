"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadProfileSchema = exports.MedicalHistorySchema = exports.PetProfileSchema = exports.CatalogItemSchema = exports.AppConfigSchema = exports.AgentConfigSchema = exports.BusinessHoursSchema = void 0;
const zod_1 = require("zod");
// ==========================================
// CONFIGURATION DOMAIN
// ==========================================
exports.BusinessHoursSchema = zod_1.z.object({
    open: zod_1.z.string().default('09:00'),
    close: zod_1.z.string().default('17:00'),
    buffer: zod_1.z.number().default(0),
    concurrency: zod_1.z.number().default(1),
    closedDays: zod_1.z.array(zod_1.z.number()).default([0]), // 0 = Domingo
    business_hours_text: zod_1.z.string().default(''),
    closed_days_text: zod_1.z.string().default(''),
    defaultDuration: zod_1.z.number().default(60),
});
exports.AgentConfigSchema = zod_1.z.object({
    systemInstructions: zod_1.z.string().default(''),
});
exports.AppConfigSchema = zod_1.z.object({
    siteName: zod_1.z.string().default('Pet Care Studio'),
    hours: exports.BusinessHoursSchema,
    agent: exports.AgentConfigSchema,
});
// ==========================================
// CATALOG DOMAIN
// ==========================================
exports.CatalogItemSchema = zod_1.z.object({
    id: zod_1.z.string().or(zod_1.z.number()).optional(),
    title: zod_1.z.string(),
    duration_minutes: zod_1.z
        .number()
        .nullable()
        .optional()
        .transform((val) => val || 60),
    price: zod_1.z
        .string()
        .nullable()
        .optional()
        .transform((val) => val || 'Por cotizar'),
});
// ==========================================
// LEAD & MEDICAL HISTORY DOMAIN
// ==========================================
exports.PetProfileSchema = zod_1.z.object({
    name: zod_1.z.string(),
    allergies: zod_1.z.array(zod_1.z.string()).optional(),
    behavior: zod_1.z.string().optional(),
    preferences: zod_1.z.array(zod_1.z.string()).optional(),
    notes: zod_1.z.string().optional(),
});
exports.MedicalHistorySchema = zod_1.z
    .object({
    pets: zod_1.z.array(exports.PetProfileSchema).optional(),
})
    .catchall(zod_1.z.any()); // Permite JSON flat migratorio
exports.LeadProfileSchema = zod_1.z.object({
    phone: zod_1.z.string(),
    name: zod_1.z.string().nullable().optional(),
    current_step: zod_1.z
        .string()
        .nullable()
        .optional()
        .transform((val) => val || 'SALUDO'),
    summary: zod_1.z
        .string()
        .nullable()
        .optional()
        .transform((val) => val || 'Nuevo Cliente'),
    bot_active: zod_1.z.boolean().default(true),
    medical_history: exports.MedicalHistorySchema.nullable().optional(),
});
