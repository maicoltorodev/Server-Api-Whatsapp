const express = require('express');
const config = require('./config');
const webhookRoutes = require('./routes/webhook');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin'); // Rutas del panel
const cors = require('cors');
const logger = require('./utils/logger').default;
const ConfigProvider = require('./core/config/ConfigProvider').default;

const app = express();

// Middleware básico
// Habilita peticiones cruzadas solo para el Dashboard autorizado
app.use(cors({ origin: config.FRONTEND_URL }));
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
// Rutas
app.use('/', healthRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);

// Error Handler Global de Express (Captura errores sincrónicos/asincrónicos no detectados en rutas)
app.use((err: any, req: any, res: any, next: any) => {
  logger.error('Error no controlado en la aplicación HTTP:', { error: err.stack || err });
  res.status(500).json({ status: 'error', message: 'Error interno inesperado en el servidor.' });
});

// Iniciar servidor encapsulando en init para cargar configuración en RAM preventiva
const startServer = async () => {
  await ConfigProvider.init();
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
    const concurrencyQueue = require('./utils/ConcurrencyQueue').default;
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

module.exports = app;
