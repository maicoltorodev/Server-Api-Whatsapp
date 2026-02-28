"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const logFormat = winston_1.default.format.printf(({ level, message, timestamp, service, ...metadata }) => {
    let msg = `${level}: ${message}`;
    if (Object.keys(metadata).length > 0) {
        // En caso de pasar objetos o errores
        if (metadata.error) {
            const err = metadata.error;
            msg += `\n  Error Stack: ${err.stack || err}`;
        }
        else {
            msg += ` ${JSON.stringify(metadata)}`;
        }
    }
    return msg;
});
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Nivel mínimo de log
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json(), // Para los archivos
    logFormat),
    defaultMeta: { service: 'pet-care-studio-backend' },
    transports: [
        // Archivos
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
        // Consola (colorizada para desarrollo)
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), logFormat)
        })
    ],
});
exports.default = logger;
