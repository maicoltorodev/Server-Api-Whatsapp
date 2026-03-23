import express from 'express';
import { botConfig } from './config/botConfig';
import webhookRoutes from './routes/webhook';
import healthRoutes from './routes/health';
import cors from 'cors';
import logger from './utils/logger';
import concurrencyQueue from './utils/ConcurrencyQueue';

const app = express();

/**
 * Extensión de la interfaz Request para incluir rawBody
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: any;
    }
  }
}

// Middleware básico (CORS genérico para la plantilla)
app.use(cors({
  origin: '*', // En un entorno de producción estricto, cambiar por dominio
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Rutas
app.use('/health', healthRoutes);
app.use('/webhook', webhookRoutes);

// Error Handler Global
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error no controlado en la aplicación HTTP:', { error: err.stack || err });
  res.status(500).json({ status: 'error', message: 'Error interno inesperado en el servidor.' });
});

// Iniciar servidor
const startServer = async () => {
  const server = app.listen(botConfig.port, () => {
    logger.info(`🤖 AI BOT TEMPLATE INICIADO - Puerto: ${botConfig.port}`);
    logger.info(`Identidad activa: ${botConfig.persona.name}`);
  });

  /**
   * MECANISMO DE APAGADO ELEGANTE (Graceful Shutdown)
   */
  const gracefulShutdown = async (signal: string) => {
    logger.warn(`[SERVER] Recibida señal ${signal}. Iniciando apagado elegante...`);
    
    server.close(() => {
      logger.info(`[SERVER] Ya no se aceptan nuevas conexiones HTTP.`);
    });

    logger.info(`[SERVER] Esperando a que las tareas de la IA finalicen...`);
    await concurrencyQueue.waitForEmpty();

    logger.info(`[SERVER] Apagado completado con éxito. Saliendo.`);
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch((err: any) => {
  logger.error('Error fatal iniciando el servidor:', { error: err });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection detectado', { promise, reason });
});

process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught Exception detectada, cerrando el proceso...', { error: err });
  process.exit(1);
});

export default app;

// Comentario para forzar re-deploy y refrescar cola de Railway.
