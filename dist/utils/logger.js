"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.securityLogger = exports.performanceLogger = void 0;
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Asegurar que exista la carpeta logs
const logDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
// Configuración configurable por entorno
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
// Configuración de múltiples destinos: Consola bonita + Archivos
const transport = pino_1.default.transport({
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
                destination: path_1.default.join(logDir, 'combined.log'),
                mkdir: true,
                append: true
            },
            level: 'info',
        },
        {
            target: 'pino/file',
            options: {
                destination: path_1.default.join(logDir, 'error.log'),
                mkdir: true,
                append: true
            },
            level: 'error',
        },
    ],
});
const logger = (0, pino_1.default)({
    level: logLevel,
    base: {
        service: 'pet-care-studio-backend',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    // En producción, reducir verbosidad para performance
    formatters: isProduction ? {
        level: (label) => ({ level: label }),
        log: (object) => {
            // Eliminar campos verbose en producción
            const { hostname, pid, ...cleaned } = object;
            return cleaned;
        }
    } : undefined
}, transport);
// Logger específico para performance (menos verboso)
exports.performanceLogger = logger.child({ component: 'performance' });
// Logger específico para seguridad (siempre a nivel warn)
exports.securityLogger = logger.child({ component: 'security' });
exports.securityLogger.level = 'warn';
// Logger específico para auditoría (siempre info)
exports.auditLogger = logger.child({ component: 'audit' });
exports.auditLogger.level = 'info';
exports.default = logger;
