import winston from 'winston';

// Formato personalizado para los logs
const logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (Object.keys(metadata).length > 0) {
        // En caso de pasar objetos o errores
        if (metadata.error) {
            const err = metadata.error as any;
            msg += `\nError Stack: ${err.stack || err}`;
        } else {
            msg += `\nMeta: ${JSON.stringify(metadata, null, 2)}`;
        }
    }
    return msg;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Nivel mínimo de log
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(), // Para los archivos
        logFormat
    ),
    defaultMeta: { service: 'pet-care-studio-backend' },
    transports: [
        // Archivos
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),

        // Consola (colorizada para desarrollo)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        })
    ],
});

export default logger;
