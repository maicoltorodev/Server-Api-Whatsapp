"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogItemSchema = void 0;
const zod_1 = require("zod");
// ==========================================
// CATALOG DOMAIN
// ==========================================
exports.CatalogItemSchema = zod_1.z.object({
    id: zod_1.z.string().or(zod_1.z.number()).optional(),
    title: zod_1.z.string(),
    duration_minutes: zod_1.z
        .number()
        .nullable()
        .transform((val) => val || 60),
    price: zod_1.z
        .string()
        .nullable()
        .transform((val) => val || 'Por cotizar'),
});
