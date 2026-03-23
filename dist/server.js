"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const botConfig_1 = require("./config/botConfig");
const webhook_1 = __importDefault(require("./routes/webhook"));
const health_1 = __importDefault(require("./routes/health"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = __importDefault(require("./utils/logger"));
const ConcurrencyQueue_1 = __importDefault(require("./utils/ConcurrencyQueue"));
const app = (0, express_1.default)();
// Middleware básico (CORS genérico para la plantilla)
app.use((0, cors_1.default)({
    origin: '*', // En un entorno de producción estricto, cambiar por dominio
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
// Rutas
app.use('/health', health_1.default);
app.use('/webhook', webhook_1.default);
// Error Handler Global
app.use((err, req, res, next) => {
    logger_1.default.error('Error no controlado en la aplicación HTTP:', { error: err.stack || err });
    res.status(500).json({ status: 'error', message: 'Error interno inesperado en el servidor.' });
});
// Iniciar servidor
const startServer = async () => {
    const server = app.listen(botConfig_1.botConfig.port, () => {
        logger_1.default.info(`🤖 AI BOT TEMPLATE INICIADO - Puerto: ${botConfig_1.botConfig.port}`);
        logger_1.default.info(`Identidad activa: ${botConfig_1.botConfig.persona.name}`);
    });
    /**
     * MECANISMO DE APAGADO ELEGANTE (Graceful Shutdown)
     */
    const gracefulShutdown = async (signal) => {
        logger_1.default.warn(`[SERVER] Recibida señal ${signal}. Iniciando apagado elegante...`);
        server.close(() => {
            logger_1.default.info(`[SERVER] Ya no se aceptan nuevas conexiones HTTP.`);
        });
        logger_1.default.info(`[SERVER] Esperando a que las tareas de la IA finalicen...`);
        await ConcurrencyQueue_1.default.waitForEmpty();
        logger_1.default.info(`[SERVER] Apagado completado con éxito. Saliendo.`);
        process.exit(0);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};
startServer().catch((err) => {
    logger_1.default.error('Error fatal iniciando el servidor:', { error: err });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection detectado', { promise, reason });
});
process.on('uncaughtException', (err) => {
    logger_1.default.fatal('Uncaught Exception detectada, cerrando el proceso...', { error: err });
    process.exit(1);
});
exports.default = app;
