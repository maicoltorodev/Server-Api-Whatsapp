"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Asegurar que exista la carpeta logs
const logDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logDir)) {
    fs_1.default.mkdirSync(logDir, { recursive: true });
}
// Configuración de múltiples destinos: Consola bonita + Archivos
const transport = pino_1.default.transport({
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
            options: { destination: path_1.default.join(logDir, 'combined.log'), mkdir: true },
            level: 'info',
        },
        {
            target: 'pino/file',
            options: { destination: path_1.default.join(logDir, 'error.log'), mkdir: true },
            level: 'error',
        },
    ],
});
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    base: { service: 'pet-care-studio-backend' },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
}, transport);
exports.default = logger;
