import winston from 'winston';
import path from 'path';
import { env } from './env.js';

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf } = format;

// ─── ANSI Color Codes ────────────────────────────────────────────
export const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  // Foreground
  black:   '\x1b[30m',
  green:   '\x1b[32m',
  blue:    '\x1b[34m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  // Bright
  greenBright:  '\x1b[92m',
  blueBright:   '\x1b[94m',
  cyanBright:   '\x1b[96m',
  yellowBright: '\x1b[93m',
  redBright:    '\x1b[91m',
  magentaBright:'\x1b[95m',
  whiteBright:  '\x1b[97m',
  // Background
  bgGreen:  '\x1b[42m',
  bgBlue:   '\x1b[44m',
  bgYellow: '\x1b[43m',
  bgRed:    '\x1b[41m',
  bgCyan:   '\x1b[46m',
  bgMagenta:'\x1b[45m',
  bgWhite:  '\x1b[47m',
  bgBlack:  '\x1b[40m'
};

// ─── Perfiles de usuario ──────────────────────────────────────────
export const PERFILES = {
  1: 'Operador',
  2: 'Administrador',
};

export const getPerfilName = (perfil) => PERFILES[perfil] || `Perfil ${perfil}`;

// ─── Sanitización de Datos Sensibles ────────────────────────────────
const backendPath = path.resolve(process.cwd()).replace(/\\/g, '/');

export const sanitizeErrorText = (text) => {
  if (typeof text !== 'string') return text;

  let sanitized = text;

  // 1. Ocultar credenciales y secretos configurados en env
  if (env.db?.password) {
    sanitized = sanitized.split(env.db.password).join('***');
  }
  if (env.telegram?.botToken) {
    sanitized = sanitized.split(env.telegram.botToken).join('***');
  }
  if (env.jwt?.secret) {
    sanitized = sanitized.split(env.jwt.secret).join('***');
  }
  if (env.db?.user) {
    sanitized = sanitized.split(env.db.user).join('***');
  }

  // 2. Limpiar IPs/Hosts conocidos
  if (env.db?.server) {
    sanitized = sanitized.split(env.db.server).join('[db_host]');
  }

  // 3. Convertir rutas absolutas del backend en relativas
  sanitized = sanitized.replace(/\\/g, '/');
  sanitized = sanitized.split(backendPath).join('.');

  // Ocultar cualquier otra ruta de xampp/htdocs si existiera
  sanitized = sanitized.replace(/c:\/xampp\/htdocs\/[^\/]+\/[^\/]+/gi, '[workspace]');

  return sanitized;
};

// ─── Formato para consola (con colores e insignias de alta legibilidad) ──────────────────────────
const consoleFormat = printf(({ level, message, timestamp, category }) => {
  const ts = `${C.gray}${timestamp}${C.reset}`;
  const sanitizedMsg = sanitizeErrorText(message);

  // 1. Manejo especializado de Errores (sin caracteres corruptores)
  if (category === 'error' || level === 'error') {
    return `${ts} ${C.bgRed}${C.bold}${C.white} ERROR ${C.reset} ${sanitizedMsg}`;
  }

  // 2. Insignias por categoría
  if (category === 'session') {
    return `${ts} ${C.bgGreen}${C.bold}${C.white} SESION ${C.reset} ${C.greenBright}${sanitizedMsg}${C.reset}`;
  }
  if (category === 'action') {
    return `${ts} ${C.bgBlue}${C.bold}${C.white} ACCION ${C.reset} ${C.blueBright}${sanitizedMsg}${C.reset}`;
  }
  if (category === 'query') {
    return `${ts} ${C.bgCyan}${C.bold}${C.black} CONSULTA ${C.reset} ${C.cyanBright}${sanitizedMsg}${C.reset}`;
  }
  if (category === 'warn') {
    return `${ts} ${C.bgYellow}${C.bold}${C.black} AVISO ${C.reset} ${C.yellowBright}${sanitizedMsg}${C.reset}`;
  }
  if (category === 'system') {
    return `${ts} ${C.bgMagenta}${C.bold}${C.white} SISTEMA ${C.reset} ${C.magentaBright}${sanitizedMsg}${C.reset}`;
  }

  // 3. Formato dinámico para tags en mensajes generales
  let formatted = sanitizedMsg;
  if (formatted.includes('[BD]')) {
    formatted = formatted.replace('[BD]', `${C.bgCyan}${C.bold}${C.black} BD ${C.reset} ${C.cyanBright}`) + C.reset;
    return `${ts} ${formatted}`;
  }
  if (formatted.includes('[TELEGRAM]')) {
    formatted = formatted.replace('[TELEGRAM]', `${C.bgBlue}${C.bold}${C.white} TELEGRAM ${C.reset} ${C.blueBright}`) + C.reset;
    return `${ts} ${formatted}`;
  }
  if (formatted.includes('[WS]')) {
    formatted = formatted.replace('[WS]', `${C.bgMagenta}${C.bold}${C.white} SOCKET.IO ${C.reset} ${C.magentaBright}`) + C.reset;
    return `${ts} ${formatted}`;
  }
  if (formatted.includes('[AUTH]')) {
    formatted = formatted.replace('[AUTH]', `${C.bgYellow}${C.bold}${C.black} AUTH ${C.reset} ${C.yellowBright}`) + C.reset;
    return `${ts} ${formatted}`;
  }
  if (formatted.includes('[INFO]')) {
    formatted = formatted.replace('[INFO]', `${C.greenBright}[INFO]${C.reset}`);
    return `${ts} ${formatted}`;
  }

  return `${ts} ${C.cyan}[${level}]${C.reset}: ${formatted}`;
});

// ─── Formato para archivos (sin colores) ─────────────────────────
const fileFormat = printf(({ level, message, timestamp, category }) => {
  const cat = category ? `[${category.toUpperCase()}]` : `[${level.toUpperCase()}]`;
  const sanitizedMsg = sanitizeErrorText(message);
  return `${timestamp} ${cat} ${sanitizedMsg}`;
});

// ─── Logger principal ────────────────────────────────────────────
export const logger = createLogger({
  level: env.logLevel || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    fileFormat
  ),
  transports: [
    // Consola con colores
    new transports.Console({
      format: combine(
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      )
    }),
    // Archivo de errores
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fileFormat)
    }),
    // Archivo combinado (todo)
    new transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fileFormat)
    }),
    // Archivo de actividad de usuarios
    new transports.File({
      filename: 'logs/activity.log',
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fileFormat)
    }),
  ]
});

// ─── Métodos especializados ──────────────────────────────────────

/** 🟢 Login / Logout / Sesión */
export const logSession = (message) => {
  logger.info(message, { category: 'session' });
  import('../services/telegram.service.js')
    .then(({ registrarEvento }) => registrarEvento('sesiones', message))
    .catch(err => console.error('Error al registrar sesión en Telegram:', err.message));
};

/** 🔵 Captura / Guardado / Modificación de datos */
export const logAction = (message, subType = 'capturas') => {
  logger.info(message, { category: 'action' });
  import('../services/telegram.service.js')
    .then(({ registrarEvento }) => registrarEvento(subType))
    .catch(err => console.error('Error al registrar acción en Telegram:', err.message));
};

/** 🔵 Consulta de datos (lectura) */
export const logQuery = (message) => {
  logger.info(message, { category: 'query' });
  import('../services/telegram.service.js')
    .then(({ registrarEvento }) => registrarEvento('consultas'))
    .catch(err => console.error('Error al registrar consulta en Telegram:', err.message));
};

/** 🟡 Advertencia */
export const logWarn = (message) => {
  const sanitizedMsg = sanitizeErrorText(message);
  logger.warn(sanitizedMsg, { category: 'warn' });
  import('../services/telegram.service.js')
    .then(({ enviarAlertaWarn }) => enviarAlertaWarn(sanitizedMsg))
    .catch(err => console.error('Error al enviar advertencia a Telegram:', err.message));
};

/** 🔴 Error con detalle explícito y ubicación precisa */
export const logError = (errorData, meta = {}) => {
  let message = '';
  let structuredData = null;

  if (typeof errorData === 'object' && errorData !== null) {
    message = errorData.message || errorData.error || 'Error sin mensaje';
    const where = errorData.where || errorData.origen || meta.where || 'Módulo interno / Servidor';
    const user = errorData.user || errorData.usuario || '';
    const status = errorData.status ? `[Status ${errorData.status}] ` : '';

    // Extraer ubicación precisa del stack (archivo y línea de código)
    let ubicacion = '';
    if (errorData.stack) {
      const lines = errorData.stack.split('\n');
      const appLine = lines.find(l => (l.includes('src/') || l.includes('src\\')) && !l.includes('logger.js'));
      if (appLine) {
        ubicacion = appLine.trim().replace(/^at\s+/, '');
      } else if (lines.length > 1) {
        ubicacion = lines[1].trim().replace(/^at\s+/, '');
      }
    }

    const consoleMsg = 
      `${C.bold}${C.redBright}FALLO EN SERVIDOR${C.reset} ${C.yellowBright}${status}${C.bold}${where}${C.reset}\n` +
      `   ${C.red}│${C.reset} ${C.bold}• Detalle:${C.reset}   ${C.whiteBright}${message}${C.reset}\n` +
      (ubicacion ? `   ${C.red}│${C.reset} ${C.bold}• Ubicación:${C.reset} ${C.cyanBright}${ubicacion}${C.reset}\n` : '') +
      (user ? `   ${C.red}│${C.reset} ${C.bold}• Usuario:${C.reset}   ${C.magentaBright}${user}${C.reset}\n` : '') +
      (errorData.ip ? `   ${C.red}│${C.reset} ${C.bold}• IP:${C.reset}        ${C.gray}${errorData.ip}${C.reset}` : '');

    logger.error(sanitizeErrorText(consoleMsg), { category: 'error' });

    structuredData = {
      ...errorData,
      message: sanitizeErrorText(message),
      where: sanitizeErrorText(where),
      user: user ? sanitizeErrorText(user) : undefined,
      ip: errorData.ip,
      stack: errorData.stack ? sanitizeErrorText(errorData.stack) : undefined
    };
  } else {
    message = String(errorData);
    const where = meta.where || 'Módulo interno / Controlador';
    const consoleMsg = `${C.bold}${C.redBright}FALLO:${C.reset} ${C.yellowBright}${where}${C.reset} — ${message}`;
    logger.error(sanitizeErrorText(consoleMsg), { category: 'error' });
    structuredData = {
      message: sanitizeErrorText(message),
      where: sanitizeErrorText(where),
      user: meta.user || undefined,
      ip: meta.ip || undefined,
      stack: meta.stack ? sanitizeErrorText(meta.stack) : undefined
    };
  }

  import('../services/telegram.service.js')
    .then(({ enviarAlertaError }) => enviarAlertaError(structuredData))
    .catch(err => console.error('Error al enviar error a Telegram:', err.message));
};

/** 🟣 Sistema (arranque, etc.) */
export const logSystem = (message) => {
  logger.info(message, { category: 'system' });
};

// Helper para identificar al usuario en logs
export const userTag = (user) => {
  if (!user) return '[anónimo]';
  const id = user.idUsuario || user.idusuario || user.id;
  const parts = [`id=${id || 'desconocido'}`];
  if (user.nombre) parts.push(user.nombre);
  
  const perfil = user.permiso !== undefined ? user.permiso : user.perfil;
  if (perfil !== undefined) {
    parts.push(getPerfilName(perfil));
  }
  
  if (user.idsede !== undefined) {
    parts.push(`Sede=${user.idsede}`);
  }
  return `[${parts.join(' | ')}]`;
};
