import express from 'express';
import config from './config';
import webhookRoutes from './routes/webhook';
import healthRoutes from './routes/health';
import adminRoutes from './routes/admin'; // Rutas del panel
import cors from 'cors';
import logger from './utils/logger';
import ConfigProvider from './core/config/ConfigProvider';
import maintenanceService from './services/maintenanceService';
import concurrencyQueue from './utils/ConcurrencyQueue';

const app = express();

/**
 * Extensión de la interfaz Request para incluir rawBody
 */
declare global {
  namespace Express {
    interface Request {
      rawBody?: any;
    }
  }
}

// Middleware básico
// Habilita peticiones cruzadas (CORS) con lista blanca dinámica (Enterprise Ready)
app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin 'origin' (como apps móviles o curl) 
    // y comparar el origin con nuestra lista de dominios autorizados
    if (!origin || config.ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS Error: Origin ${origin} not allowed by whitelist.`));
    }
  },
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
app.use('/', healthRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);

// Error Handler Global de Express (Captura errores sincrónicos/asincrónicos no detectados en rutas)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error no controlado en la aplicación HTTP:', { error: err.stack || err });
  res.status(500).json({ status: 'error', message: 'Error interno inesperado en el servidor.' });
});

// Iniciar servidor encapsulando en init para cargar configuración en RAM preventiva
const startServer = async () => {
  await ConfigProvider.init();

  // Iniciar servicio de mantenimiento automático
  maintenanceService.init();

  const server = app.listen(config.PORT, () => {
    // REINICIO FORZADO POR ANTIGRAVITY
    logger.info(`SERVIDOR ENTERPRISE ACTIVO - Puerto: ${config.PORT}`);
  });

  /**
   * MECANISMO DE APAGADO ELEGANTE (Graceful Shutdown)
   * Protege las tareas de la IA en curso antes de que el servidor muera.
   */
  const gracefulShutdown = async (signal: string) => {
    logger.warn(`[SERVER] Recibida señal ${signal}. Iniciando apagado elegante...`);

    // 1. Dejar de aceptar nuevas conexiones
    server.close(() => {
      logger.info(`[SERVER] Ya no se aceptan nuevas conexiones HTTP.`);
    });

    // 2. Esperar a que la cola de concurrencia de la IA termine sus procesos
    logger.info(`[SERVER] Esperando a que las tareas de la IA finalicen...`);
    await concurrencyQueue.waitForEmpty();

    logger.info(`[SERVER] Apagado completado con éxito. Saliendo.`);
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch((err: any) => {
  logger.error('Error fatal inicializando la configuración:', { error: err });
  process.exit(1);
});

// Captura global de promesas no manejadas y excepciones fatales para no apagar Node.js silenciosamente
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection detectado', { promise, reason });
});

process.on('uncaughtException', (err) => {
  logger.fatal('Uncaught Exception detectada, cerrando el proceso de forma segura...', { error: err });
  process.exit(1);
});

export default app;

