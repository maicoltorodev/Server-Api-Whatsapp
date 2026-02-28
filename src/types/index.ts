import { z } from 'zod';

// ==========================================
// CONFIGURATION DOMAIN
// ==========================================

export const BusinessHoursSchema = z.object({
  open: z.string().default('09:00'),
  close: z.string().default('17:00'),
  buffer: z.number().default(0),
  concurrency: z.number().default(1),
  closedDays: z.array(z.number()).default([0]), // 0 = Domingo
  business_hours_text: z.string().default(''),
  closed_days_text: z.string().default(''),
  defaultDuration: z.number().default(60),
});

export const AgentConfigSchema = z.object({
  systemInstructions: z.string().default(''),
});

export const AppConfigSchema = z.object({
  siteName: z.string().default('Pet Care Studio'),
  hours: BusinessHoursSchema,
  agent: AgentConfigSchema,
});

export type IAppConfig = z.infer<typeof AppConfigSchema>;

// ==========================================
// CATALOG DOMAIN
// ==========================================

export const CatalogItemSchema = z.object({
  id: z.string().or(z.number()).optional(),
  title: z.string(),
  duration_minutes: z
    .number()
    .nullable()
    .optional()
    .transform((val) => val || 60),
  price: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val || 'Por cotizar'),
});

export type ICatalogItem = z.infer<typeof CatalogItemSchema>;

// ==========================================
// LEAD & MEDICAL HISTORY DOMAIN
// ==========================================

export const PetProfileSchema = z.object({
  name: z.string(),
  allergies: z.array(z.string()).optional(),
  behavior: z.string().optional(),
  preferences: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const MedicalHistorySchema = z
  .object({
    pets: z.array(PetProfileSchema).optional(),
  })
  .catchall(z.any()); // Permite JSON flat migratorio

export const LeadProfileSchema = z.object({
  phone: z.string(),
  name: z.string().nullable().optional(),
  current_step: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val || 'SALUDO'),
  summary: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val || 'Nuevo Cliente'),
  bot_active: z.boolean().default(true),
  medical_history: MedicalHistorySchema.nullable().optional(),
});

export type ILeadProfile = z.infer<typeof LeadProfileSchema>;
export type IPetProfile = z.infer<typeof PetProfileSchema>;
