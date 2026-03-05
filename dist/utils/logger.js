"use strict";
/**
 * Simple Logger (Native Console)
 * Logs nativos con colores, iconos y formato claro sin dependencias (ANSI).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.securityLogger = exports.performanceLogger = void 0;
const colors = {
    reset: "\x1b[0m",
    info: "\x1b[36m", // Cyan
    success: "\x1b[32m", // Verde
    warn: "\x1b[33m", // Amarillo
    error: "\x1b[31m", // Rojo
    debug: "\x1b[35m", // Magenta
    fatal: "\x1b[41m\x1b[37m", // Fondo rojo, texto blanco
    gray: "\x1b[90m", // Gris
    bold: "\x1b[1m" // Negrita
};
const icons = {
    info: "🔹",
    success: "✅",
    warn: "⚠️",
    error: "❌",
    debug: "🐛",
    fatal: "💀",
};
// Genera el reloj exacto en hora de Bogotá nativo de JS
const getTimestamp = () => {
    const now = new Date();
    const timeInfo = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(now);
    return `${colors.gray}[${timeInfo}]${colors.reset}`;
};
// Limpia el objeto si viene como data (evita un [object Object])
const formatearData = (data) => {
    if (!data)
        return '';
    // Si la `data` tiene un error en formato JSON, imprimimos el stack completo
    if (data instanceof Error || data?.error instanceof Error) {
        return `\n${colors.gray}${data.stack || data.error?.stack}${colors.reset}`;
    }
    return `\n  ${colors.gray}↳ ${JSON.stringify(data, null, 2)}${colors.reset}`;
};
const formatMessage = (level, icon, msg, component) => {
    const prefix = component ? `${colors.bold}${colors.debug}[${component}]${colors.reset} ` : '';
    const color = colors[level] || colors.reset;
    const timestamp = getTimestamp();
    // Soporte nativo multilínea: Si el mensaje trae saltos de línea (ej: grandes textos o prompts)
    // prefijamos CADA línea con la marca de tiempo para que la consola se vea uniforme.
    if (msg.includes('\n')) {
        return msg
            .split('\n')
            .map(line => `${timestamp} ${icon} ${prefix}${color}${line}${colors.reset}`)
            .join('\n');
    }
    return `${timestamp} ${icon} ${prefix}${color}${msg}${colors.reset}`;
};
const createLogger = (component) => {
    return {
        level: 'info', // Propiedad dummy para mantener compatibilidad
        info: (msg, data) => {
            console.log(formatMessage('info', icons.info, msg, component) + formatearData(data));
        },
        success: (msg, data) => {
            console.log(formatMessage('success', icons.success, msg, component) + formatearData(data));
        },
        error: (msg, data) => {
            console.error(formatMessage('error', icons.error, msg, component) + formatearData(data));
        },
        warn: (msg, data) => {
            console.warn(formatMessage('warn', icons.warn, msg, component) + formatearData(data));
        },
        debug: (msg, data) => {
            console.debug(formatMessage('debug', icons.debug, msg, component) + formatearData(data));
        },
        fatal: (msg, data) => {
            console.error(formatMessage('fatal', icons.fatal, `[FATAL RUNTIME] ${msg}`, component) + formatearData(data));
        },
        child: (options) => createLogger(options.component)
    };
};
const logger = createLogger();
// Loggers específicos requeridos por la aplicación
exports.performanceLogger = createLogger('performance');
exports.securityLogger = createLogger('security');
exports.securityLogger.level = 'warn';
exports.auditLogger = createLogger('audit');
exports.auditLogger.level = 'info';
exports.default = logger;
