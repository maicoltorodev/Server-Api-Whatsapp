"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = exports.securityLogger = exports.performanceLogger = exports.correlationContext = void 0;
const node_async_hooks_1 = require("node:async_hooks");
/**
 * Simple Logger (Native Console)
 * Logs nativos con colores, iconos y formato claro sin dependencias (ANSI).
 */
exports.correlationContext = new node_async_hooks_1.AsyncLocalStorage();
const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
    // Colors
    info: "\x1b[36m", // Cyan
    success: "\x1b[32m", // Verde
    warn: "\x1b[33m", // Amarillo
    error: "\x1b[31m", // Rojo
    debug: "\x1b[35m", // Magenta
    white: "\x1b[37m", // Blanco
    gray: "\x1b[90m", // Gris oscuro
    fatal: "\x1b[41m\x1b[37m", // Fondo rojo, texto blanco
};
const icons = {
    info: "🔹",
    success: "✅",
    warn: "⚠️",
    error: "❌",
    debug: "🐛",
    fatal: "💀",
};
// Genera el reloj exacto en hora de Bogotá nativo de JS (Dimmed for less noise)
const getTimestamp = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const context = exports.correlationContext.getStore();
    const requestId = context ? `${colors.white}[#${context.id}]${colors.reset} ` : '';
    return `${colors.gray}${colors.dim}[${time}.${ms}]${colors.reset} ${requestId}`;
};
// Formatea el mensaje aplicando jerarquía visual (Título Bold + Contenido Dim)
const applyHierarchy = (msg, color) => {
    // Regex para detectar patrones tipo [SISTEMA] o [IA - PROCESANDO]
    const titleRegex = /^(\[.*?\])(.*)$/;
    const match = msg.match(titleRegex);
    if (match) {
        const title = match[1];
        const content = match[2];
        return `${colors.bold}${color}${title}${colors.reset}${colors.gray}${content}${colors.reset}`;
    }
    return `${color}${msg}${colors.reset}`;
};
// Limpia el objeto si viene como data (evita un [object Object])
const formatearData = (data) => {
    if (!data)
        return '';
    if (data instanceof Error || data?.error instanceof Error) {
        return `\n${colors.gray}${colors.dim}${data.stack || data.error?.stack}${colors.reset}`;
    }
    // JSON data en gris muy suave
    const json = JSON.stringify(data, null, 2);
    return `\n  ${colors.gray}${colors.dim}↳ ${json.replace(/\n/g, '\n  ')}${colors.reset}`;
};
const formatMessage = (level, icon, msg, component) => {
    const timestamp = getTimestamp();
    const color = colors[level] || colors.reset;
    const prefix = component ? `${colors.bold}${colors.debug}[${component}]${colors.reset} ` : '';
    if (msg.includes('\n')) {
        return msg
            .split('\n')
            .map(line => `${timestamp} ${icon} ${prefix}${applyHierarchy(line, color)}`)
            .join('\n');
    }
    return `${timestamp} ${icon} ${prefix}${applyHierarchy(msg, color)}`;
};
const createLogger = (component) => {
    return {
        level: 'info',
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
            console.error(formatMessage('fatal', icons.fatal, `[FATAL] ${msg}`, component) + formatearData(data));
        },
        child: (options) => createLogger(options.component)
    };
};
const logger = createLogger();
exports.performanceLogger = createLogger('performance');
exports.securityLogger = createLogger('security');
exports.auditLogger = createLogger('audit');
exports.default = logger;
