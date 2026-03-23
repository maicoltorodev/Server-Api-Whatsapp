import { z } from 'zod';

// ==========================================
// CATALOG DOMAIN
// ==========================================

export const CatalogItemSchema = z.object({
  id: z.string().or(z.number()).optional(),
  title: z.string(),
  duration_minutes: z
    .number()
    .nullable()
    .transform((val) => val || 60),
  price: z
    .string()
    .nullable()
    .transform((val) => val || 'Por cotizar'),
});

export type ICatalogItem = z.infer<typeof CatalogItemSchema>;
