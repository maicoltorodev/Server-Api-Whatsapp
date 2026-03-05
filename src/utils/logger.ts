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

const getConsoleTransport = () => {
  if (isDevelopment) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
      level: 'debug',
    };
  }
  // En producción (Railway), usar salida estándar limpia para evitar caídas por dependencias dev
  return {
    target: 'pino/file', // Imprime a process.stdout por defecto si no hay destination
    options: { destination: 1 },
    level: 'info',
  };
};

const transport = pino.transport({
  targets: [
    getConsoleTransport() as any,
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
