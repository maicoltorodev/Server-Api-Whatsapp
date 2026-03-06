import { Request, Response } from 'express';
import supabase from '../config/database';
import { genAI } from '../config/ai';
import config from '../config';

export class HealthController {
  /**
   * Endpoint básico de salud
   */
  public async checkHealth(req: Request, res: Response) {
    res.status(200).send('✅ WhatsApp Bot Online');
  }

  /**
   * Endpoint detallado de salud con estado del sistema
   */
  public async checkDetailedHealth(req: Request, res: Response) {
    const healthStatus: any = {
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
      const { error } = await supabase.from('leads').select('id').limit(1);
      healthStatus.services.database = error ? 'error' : 'healthy';
    } catch (error) {
      healthStatus.services.database = 'error';
    }

    // Verificar servicio de IA
    try {
      // Intentar una operación simple para verificar la API key
      if (genAI) {
        healthStatus.services.ai = 'healthy';
      } else {
        healthStatus.services.ai = 'error';
      }
    } catch (error) {
      healthStatus.services.ai = 'error';
    }

    // Verificar configuración de WhatsApp
    try {
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

export default new HealthController();

