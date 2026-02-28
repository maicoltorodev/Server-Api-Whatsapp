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
app.use(cors()); // Habilita peticiones cruzadas para el Dashboard (React/Vue/Angular)
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

// Iniciar servidor encapsulando en init para cargar configuración en RAM preventiva
const startServer = async () => {
  await ConfigProvider.init();
  const server = app.listen(config.PORT, () => {
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

module.exports = app;
