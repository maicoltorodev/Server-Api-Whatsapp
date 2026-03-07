/**
 * Simple Logger (Native Console)
 * Logs nativos con colores, iconos y formato claro sin dependencias (ANSI).
 */

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  // Colors
  info: "\x1b[36m",    // Cyan
  success: "\x1b[32m", // Verde
  warn: "\x1b[33m",    // Amarillo
  error: "\x1b[31m",   // Rojo
  debug: "\x1b[35m",   // Magenta
  white: "\x1b[37m",   // Blanco
  gray: "\x1b[90m",    // Gris oscuro
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
  const timeInfo = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);
  return `${colors.gray}${colors.dim}[${timeInfo}]${colors.reset}`;
};

// Formatea el mensaje aplicando jerarquía visual (Título Bold + Contenido Dim)
const applyHierarchy = (msg: string, color: string) => {
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
const formatearData = (data?: any) => {
  if (!data) return '';
  if (data instanceof Error || data?.error instanceof Error) {
    return `\n${colors.gray}${colors.dim}${data.stack || data.error?.stack}${colors.reset}`;
  }
  // JSON data en gris muy suave
  const json = JSON.stringify(data, null, 2);
  return `\n  ${colors.gray}${colors.dim}↳ ${json.replace(/\n/g, '\n  ')}${colors.reset}`;
};

const formatMessage = (level: keyof typeof colors, icon: string, msg: string, component?: string) => {
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

const createLogger = (component?: string) => {
  return {
    level: 'info',

    info: (msg: string, data?: any) => {
      console.log(formatMessage('info', icons.info, msg, component) + formatearData(data));
    },

    success: (msg: string, data?: any) => {
      console.log(formatMessage('success', icons.success, msg, component) + formatearData(data));
    },

    error: (msg: string, data?: any) => {
      console.error(formatMessage('error', icons.error, msg, component) + formatearData(data));
    },

    warn: (msg: string, data?: any) => {
      console.warn(formatMessage('warn', icons.warn, msg, component) + formatearData(data));
    },

    debug: (msg: string, data?: any) => {
      console.debug(formatMessage('debug', icons.debug, msg, component) + formatearData(data));
    },

    fatal: (msg: string, data?: any) => {
      console.error(formatMessage('fatal', icons.fatal, `[FATAL] ${msg}`, component) + formatearData(data));
    },

    child: (options: { component?: string }) => createLogger(options.component)
  };
};

const logger = createLogger();

export const performanceLogger = createLogger('performance');
export const securityLogger = createLogger('security');
export const auditLogger = createLogger('audit');

export default logger;
