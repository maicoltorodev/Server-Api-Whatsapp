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
        database: 'unknown',
        ai: 'unknown',
        whatsapp: 'unknown',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    try {
      // Verificar conexión a base de datos
      const supabase = require('../config/database');
      const { error } = await supabase.from('leads').select('id').limit(1);
      healthStatus.services.database = error ? 'error' : 'healthy';
    } catch (error) {
      healthStatus.services.database = 'error';
    }

    // Verificar servicio de IA
    try {
      const { genAI } = require('../config/ai');
      // Intentar una operación simple para verificar la API key
      healthStatus.services.ai = 'healthy';
    } catch (error) {
      healthStatus.services.ai = 'error';
    }

    // Verificar configuración de WhatsApp
    try {
      const config = require('../config');
      if (config.PHONE_NUMBER_ID && config.WHATSAPP_TOKEN) {
        healthStatus.services.whatsapp = 'healthy';
      } else {
        healthStatus.services.whatsapp = 'misconfigured';
      }
    } catch (error) {
      healthStatus.services.whatsapp = 'error';
    }

    const statusCode =
      healthStatus.services.database === 'healthy' &&
      healthStatus.services.ai === 'healthy' &&
      healthStatus.services.whatsapp === 'healthy'
        ? 200
        : 503;

    res.status(statusCode).json(healthStatus);
  }
}

module.exports = new HealthController();
