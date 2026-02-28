import pino from 'pino';
import fs from 'fs';
import path from 'path';

// Asegurar que exista la carpeta logs
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuración de múltiples destinos: Consola bonita + Archivos
const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
      level: 'info',
    },
    {
      target: 'pino/file',
      options: { destination: path.join(logDir, 'combined.log'), mkdir: true },
      level: 'info',
    },
    {
      target: 'pino/file',
      options: { destination: path.join(logDir, 'error.log'), mkdir: true },
      level: 'error',
    },
  ],
});

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'pet-care-studio-backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

export default logger;
