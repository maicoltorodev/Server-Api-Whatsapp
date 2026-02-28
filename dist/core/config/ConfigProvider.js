"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase = require('../../config/database');
const logger = require('../../utils/logger').default;
const types_1 = require("../../types");
class ConfigProvider {
    static instance;
    config = null;
    catalog = [];
    catalogString = '';
    isInitialized = false;
    constructor() { }
    static getInstance() {
        if (!ConfigProvider.instance) {
            ConfigProvider.instance = new ConfigProvider();
        }
        return ConfigProvider.instance;
    }
    /**
     * Initializes the memory cache from the database.
     * Must be called on server start.
     */
    async init() {
        await this.reload();
    }
    /**
     * Reloads configuration from DB and validates via Zod schemas.
     * Guaranteed to not block running threads once initialized.
     */
    async reload() {
        try {
            logger.info('[ConfigProvider] Descargando configuración fresca de la Base de Datos...');
            const [siteRes, aiRes, catalogRes] = await Promise.all([
                supabase.from('site_content').select('key, value'),
                supabase.from('ai_settings').select('key, value'),
                supabase.from('services').select('*'),
            ]);
            // Transform KV to raw Object
            const rawConfig = {};
            [...(siteRes.data || []), ...(aiRes.data || [])].forEach((item) => {
                const key = item.key.toLowerCase();
                let value = item.value;
                // Parse numbers and arrays if possible
                if (!isNaN(Number(value)) && value.trim() !== '') {
                    value = Number(value);
                }
                else if (typeof value === 'string' &&
                    value.includes(',') &&
                    !isNaN(Number(value.split(',')[0]))) {
                    value = value
                        .split(',')
                        .map((d) => Number(d.trim()))
                        .filter((n) => !isNaN(n));
                }
                rawConfig[key] = value;
            });
            // Map raw to matching schema structure
            const mappedConfig = {
                siteName: rawConfig.site_name,
                hours: {
                    open: rawConfig.agenda_open,
                    close: rawConfig.agenda_close,
                    buffer: rawConfig.agenda_buffer,
                    concurrency: rawConfig.simultaneous_appointments || rawConfig.agenda_concurrency,
                    closedDays: rawConfig.agenda_closed_days,
                    business_hours_text: rawConfig.business_hours,
                    closed_days_text: rawConfig.closed_days,
                    defaultDuration: rawConfig.appointment_duration_minutes,
                },
                agent: {
                    systemInstructions: rawConfig.system_instructions || rawConfig.bot_system_prompt || '',
                },
            };
            // STRICT VALIDATION
            const parsedConfig = types_1.AppConfigSchema.safeParse(mappedConfig);
            if (!parsedConfig.success) {
                logger.warn(`[ConfigProvider] Advertencia de validación en configuración. Usando defaults. Detalles:`, parsedConfig.error.format());
                // Fallback a defaults si falla
                this.config = types_1.AppConfigSchema.parse({});
            }
            else {
                this.config = parsedConfig.data;
            }
            // Parse Catalog
            if (catalogRes.data) {
                this.catalog = catalogRes.data
                    .map((item) => {
                    const parsed = types_1.CatalogItemSchema.safeParse(item);
                    return parsed.success ? parsed.data : null;
                })
                    .filter(Boolean);
                this.catalogString = this.catalog
                    .map((s) => `- ${s.title}: (Duración: ${s.duration_minutes} mins) - Precio: ${s.price}`)
                    .join('\n');
            }
            else {
                this.catalog = [];
                this.catalogString = 'El catálogo está vacío.';
            }
            this.isInitialized = true;
            logger.info('[ConfigProvider] Configuración en RAM cargada exitosamente.');
        }
        catch (error) {
            logger.error('[ConfigProvider] Fallo crítico cargando configuración:', { error });
            if (!this.isInitialized) {
                // Si falla en el primer arranque, inicializa con defaults
                this.config = types_1.AppConfigSchema.parse({});
                this.catalog = [];
                this.catalogString = 'Catálogo no disponible.';
                this.isInitialized = true;
            }
        }
    }
    /**
     * Exposes strictly typed immutable app config.
     */
    getConfig() {
        if (!this.config) {
            throw new Error('ConfigProvider no ha sido inicializado.');
        }
        return this.config;
    }
    /**
     * Exposes the service catalog array.
     */
    getCatalogArray() {
        return this.catalog;
    }
    /**
     * Exposes the stringified service catalog for AI.
     */
    getCatalogString() {
        return this.catalogString;
    }
}
exports.default = ConfigProvider.getInstance();
