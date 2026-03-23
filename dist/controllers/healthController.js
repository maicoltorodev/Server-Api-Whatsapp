"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const botConfig_1 = require("../config/botConfig");
const aiService_1 = require("../services/aiService");
class HealthController {
    /**
     * Endpoint básico de salud
     */
    async checkHealth(req, res) {
        res.status(200).send('✅ WhatsApp Bot Online');
    }
    /**
     * Endpoint detallado de salud con estado del sistema
     */
    async checkDetailedHealth(req, res) {
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                ai: 'unknown',
                whatsapp: 'unknown',
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        };
        // Verificar servicio de IA
        try {
            if (aiService_1.genAI && botConfig_1.botConfig.geminiApiKey) {
                healthStatus.services.ai = 'healthy';
            }
            else {
                healthStatus.services.ai = 'misconfigured';
            }
        }
        catch (error) {
            healthStatus.services.ai = 'error';
        }
        // Verificar configuración de WhatsApp
        try {
            if (botConfig_1.botConfig.waPhoneId && botConfig_1.botConfig.waToken) {
                healthStatus.services.whatsapp = 'healthy';
            }
            else {
                healthStatus.services.whatsapp = 'misconfigured';
            }
        }
        catch (error) {
            healthStatus.services.whatsapp = 'error';
        }
        const statusCode = healthStatus.services.ai === 'healthy' &&
            healthStatus.services.whatsapp === 'healthy'
            ? 200
            : 503;
        res.status(statusCode).json(healthStatus);
    }
}
exports.HealthController = HealthController;
exports.default = new HealthController();
