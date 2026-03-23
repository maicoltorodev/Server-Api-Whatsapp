import { Request, Response } from 'express';
import { botConfig } from '../config/botConfig';
import { genAI } from '../services/aiService';

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
        ai: 'unknown',
        whatsapp: 'unknown',
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    // Verificar servicio de IA
    try {
      if (genAI && botConfig.geminiApiKey) {
        healthStatus.services.ai = 'healthy';
      } else {
        healthStatus.services.ai = 'misconfigured';
      }
    } catch (error) {
      healthStatus.services.ai = 'error';
    }

    // Verificar configuración de WhatsApp
    try {
      if (botConfig.waPhoneId && botConfig.waToken) {
        healthStatus.services.whatsapp = 'healthy';
      } else {
        healthStatus.services.whatsapp = 'misconfigured';
      }
    } catch (error) {
      healthStatus.services.whatsapp = 'error';
    }

    const statusCode =
      healthStatus.services.ai === 'healthy' &&
      healthStatus.services.whatsapp === 'healthy'
        ? 200
        : 503;

    res.status(statusCode).json(healthStatus);
  }
}

export default new HealthController();

