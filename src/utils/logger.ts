import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Asegurar que exista la carpeta logs
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuración configurable por entorno
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Configuración de múltiples destinos: Consola bonita + Archivos
const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      options: {
        colorize: isDevelopment,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        levelFirst: isDevelopment,
        messageFormat: isDevelopment ? '{service} [{level}] {msg}' : '{service} [{level}] {msg}',
      },
      level: isDevelopment ? 'debug' : 'info',
    },
    {
      target: 'pino/file',
      options: { 
        destination: path.join(logDir, 'combined.log'), 
        mkdir: true,
        append: true
      },
      level: 'info',
    },
    {
      target: 'pino/file',
      options: { 
        destination: path.join(logDir, 'error.log'), 
        mkdir: true,
        append: true
      },
      level: 'error',
    },
  ],
});

const logger = pino(
  {
    level: logLevel,
    base: { 
      service: 'pet-care-studio-backend',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // En producción, reducir verbosidad para performance
    formatters: isProduction ? {
      level: (label) => ({ level: label }),
      log: (object) => {
        // Eliminar campos verbose en producción
        const { hostname, pid, ...cleaned } = object;
        return cleaned;
      }
    } : undefined
  },
  transport
);

// Logger específico para performance (menos verboso)
export const performanceLogger = logger.child({ component: 'performance' });

// Logger específico para seguridad (siempre a nivel warn)
export const securityLogger = logger.child({ component: 'security' });
securityLogger.level = 'warn';

// Logger específico para auditoría (siempre info)
export const auditLogger = logger.child({ component: 'audit' });
auditLogger.level = 'info';

export default logger;
