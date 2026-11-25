import axios from 'axios';
import { env } from '../config/env.js';
import { sanitizeErrorText } from '../config/logger.js';

const AMBIENTE_EMOJI = {
  local: '💻',
  development: '🧪',
  staging: '🧪',
  production: '🚨'
};

// Contadores en memoria para actividades complementarias
const contadores = {
  reportes_generados: 0,
  consultas: 0
};

function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function registrarEvento(tipo, detail = null) {
  if (tipo === 'sesiones') return;
  if (tipo === 'consultas' || tipo === 'reportes') {
    contadores.consultas++;
  }
}

/**
 * 📊 Resumen de Métricas Institucionales (SICECyCC 2027)
 * Se dispara automáticamente de Lunes a Viernes a las 09:00 hrs y a las 18:00 hrs (o manualmente).
 */
export async function enviarResumenActividad(turno = null) {
  const ambiente = env.nodeEnv || 'development';
  const emoji = AMBIENTE_EMOJI[ambiente] || '🧪';

  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });

  // Obtener métricas reales en vivo de la base de datos
  let totalAcciones = 0;
  let sinCapturar = 0;
  let totalCapturadas = 0;
  let totalEncuestas = 0;

  try {
    const { getAdminDashboardMetrics } = await import('../models/actividadModel.js');
    const metrics = await getAdminDashboardMetrics();
    if (metrics) {
      totalAcciones = Number(metrics.total_acciones || 0);
      sinCapturar = Number(metrics.sin_capturar || 0);
      totalCapturadas = Number(metrics.total_capturadas || (Number(metrics.capturadas || 0) + Number(metrics.finalizadas || 0)) || 0);
      totalEncuestas = Number(metrics.total_encuestas || 0);
    }
  } catch (mErr) {
    // fallback
  }

  const corteTexto = turno || '🌅 Turno Matutino (09:00 hrs)';
  const totalReportes = contadores.consultas || 0;

  // Formato exacto e intuitivo solicitado
  const mensaje = 
    `${emoji} [${ambiente.toUpperCase()}]\n` +
    ` SICECyCC 2027\n` +
    `🕐 Fecha y Hora: ${fechaStr} ${horaStr}\n` +
    `🏷️ Corte: ${corteTexto}\n\n` +
    `✅ Acciones Totales: ${totalAcciones}\n` +
    `📚 Sin capturar: ${sinCapturar}\n` +
    `👥 Capturadas o finalizadas: ${totalCapturadas}\n` +
    `📝 Encuestas respondidas: ${totalEncuestas}\n\n` +
    `🔵 Reportes: ${totalReportes}`;

  try {
    await enviarMensajeTelegram(mensaje, 'resumen_diario');
  } catch (err) {
    import('../config/logger.js').then(({ logger }) => {
      logger.error(`[TELEGRAM_ERROR] Error enviando resumen de métricas: ${err.message}`);
    }).catch(() => {});
  }
}

/**
 * 📈 Acumulado Histórico Global (Viernes a las 09:00 hrs)
 */
export async function enviarResumenHistorico() {
  await enviarResumenActividad('🗓️ Acumulado Semanal (Viernes)');
}

/**
 * ⏰ Programador Automático de Horarios Fijos:
 * - Resumen Matutino: Lunes a Viernes a las 09:00 hrs.
 * - Resumen Vespertino: Lunes a Viernes a las 18:00 hrs.
 */
const marcasEjecucion = {
  actividad: '',
  historico: ''
};

function verificarProgramadores() {
  const now = new Date();
  const day = now.getDay(); // 0: Dom, 1: Lun, ..., 5: Vie, 6: Sab
  const hours = now.getHours();
  const minutes = now.getMinutes();

  const fechaStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const claveHora = `${fechaStr}-${String(hours).padStart(2, '0')}`;

  const esLunesAViernes = day >= 1 && day <= 5;
  const esHoraActividad = (hours === 9 || hours === 18) && minutes === 0;

  if (esLunesAViernes && esHoraActividad && marcasEjecucion.actividad !== claveHora) {
    marcasEjecucion.actividad = claveHora;
    const turno = hours === 9 ? '🌅 Turno Matutino (09:00 hrs)' : '🌆 Turno Vespertino (18:00 hrs)';
    enviarResumenActividad(turno).catch(err => {
      import('../config/logger.js').then(({ logger }) => {
        logger.error(`[TELEGRAM_SCHEDULER] Error al enviar resumen de actividad: ${err.message}`);
      }).catch(() => {});
    });
  }
}

setInterval(verificarProgramadores, 20 * 1000);

/**
 * 📩 Notificación Instantánea: Mensaje de Admin al Superadmin
 * Se despacha inmediatamente cuando un administrador envía un mensaje interno destinado al superadmin.
 */
export async function enviarMensajeAdminASuperadminTelegram({
  usuarioOrigen,
  nombreOrigen,
  rolOrigen,
  distritoOrigen,
  titulo,
  mensaje,
  comentarioAdicional,
  folioAccion
}) {
  const ambiente = env.nodeEnv || 'development';
  const emoji = AMBIENTE_EMOJI[ambiente] || '🧪';
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });

  const origenTxt = distritoOrigen && Number(distritoOrigen) > 0 ? `Distrito ${distritoOrigen}` : 'Oficina Central';

  let cuerpo = 
    `${emoji} [${ambiente.toUpperCase()}]\n` +
    `📩 <b>NUEVO MENSAJE AL SUPERADMIN</b>\n` +
    `🕐 <b>Fecha y Hora:</b> ${fechaStr} ${horaStr}\n\n` +
    `👤 <b>De:</b> ${escapeHtml(nombreOrigen || usuarioOrigen || 'Administrador')} (${escapeHtml(rolOrigen || 'Admin')} - ${origenTxt})\n` +
    `🎯 <b>Para:</b> Super Administrador\n` +
    `🏷️ <b>Asunto:</b> ${escapeHtml(titulo)}\n` +
    `💬 <b>Mensaje:</b> ${escapeHtml(mensaje)}\n`;

  if (comentarioAdicional && String(comentarioAdicional).trim()) {
    cuerpo += `📝 <b>Comentario adicional:</b> ${escapeHtml(String(comentarioAdicional).trim())}\n`;
  }
  if (folioAccion) {
    cuerpo += `🆔 <b>Acción Educativa:</b> <code>${escapeHtml(folioAccion)}</code>\n`;
  }

  await enviarMensajeTelegram(cuerpo, 'alertas_admin');
}

/**
 * ⚠️ Alerta de Advertencia
 */
export async function enviarAlertaWarn(message) {
  const ambiente = env.nodeEnv || 'development';
  const emoji = AMBIENTE_EMOJI[ambiente] || '🧪';
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });

  const mensaje = `${emoji} <b>[${ambiente.toUpperCase()}]</b>\n` +
    `⚠️ <b>Aviso / Advertencia - SICEC 2027</b>\n` +
    `🕐 <b>Fecha y Hora:</b> ${fechaStr} ${horaStr}\n\n` +
    `<pre>${escapeHtml(sanitizeErrorText(message))}</pre>`;

  await enviarMensajeTelegram(mensaje, 'alertas_errores');
}

/**
 * 🚨 Alerta de Errores Críticos
 */
export async function enviarAlertaError(errorInfo) {
  const ambiente = env.nodeEnv || 'development';
  const emoji = AMBIENTE_EMOJI[ambiente] || '🚨';
  const now = new Date();
  const fechaStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaStr = now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour12: false });

  let mensajeError = '';
  let donde = 'Módulo interno del servidor';
  let usuario = null;
  let ip = null;
  let stack = null;

  if (typeof errorInfo === 'object' && errorInfo !== null) {
    mensajeError = errorInfo.message || errorInfo.error || JSON.stringify(errorInfo);
    donde = errorInfo.where || errorInfo.origen || donde;
    usuario = errorInfo.user || errorInfo.usuario || null;
    ip = errorInfo.ip || null;
    stack = errorInfo.stack || null;
  } else {
    const raw = String(errorInfo || 'Error no especificado');
    mensajeError = raw;
    if (raw.includes('—')) {
      const parts = raw.split('—').map(p => p.trim());
      if (parts.length >= 2) {
        donde = parts[0].replace(/^[❌⚠️💥\s]+/, '').replace(/^\[ERROR\]\s*/i, '').trim();
        mensajeError = parts[1];
        if (parts[2]) {
          usuario = parts[2];
        }
      }
    }
  }

  const sanitizedMsg = sanitizeErrorText(mensajeError);
  const sanitizedDonde = sanitizeErrorText(donde);
  const sanitizedUser = usuario ? sanitizeErrorText(usuario) : null;
  const sanitizedStack = stack ? sanitizeErrorText(stack) : null;

  let cuerpoMensaje = `${emoji} <b>[${ambiente.toUpperCase()}] 🚨 ERROR EN SERVIDOR</b>\n` +
    `🕐 <b>Fecha y Hora:</b> ${fechaStr} ${horaStr}\n\n` +
    `📍 <b>Origen:</b> <code>${escapeHtml(sanitizedDonde)}</code>\n`;

  if (sanitizedUser) {
    cuerpoMensaje += `👤 <b>Usuario:</b> ${escapeHtml(sanitizedUser)}\n`;
  }
  if (ip) {
    cuerpoMensaje += `🌐 <b>IP:</b> <code>${escapeHtml(ip)}</code>\n`;
  }

  cuerpoMensaje += `\n💥 <b>Detalle del error:</b>\n` +
    `<pre>${escapeHtml(sanitizedMsg)}</pre>`;

  if (sanitizedStack) {
    const stackLines = sanitizedStack
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.includes('node:internal') && !l.includes('node_modules'))
      .slice(0, 4)
      .join('\n');

    if (stackLines) {
      cuerpoMensaje += `\n\n📋 <b>Ubicación en código (Stack):</b>\n` +
        `<pre>${escapeHtml(stackLines)}</pre>`;
    }
  }

  await enviarMensajeTelegram(cuerpoMensaje, 'alertas_errores');
}

/**
 * 📤 Envío centralizado a la API de Telegram respetando la configuración del Super Admin
 */
export async function enviarMensajeTelegram(text, categoria = null) {
  try {
    const token = env.telegram?.botToken;
    const chatId = env.telegram?.chatId;
    if (!token || !chatId) return;

    // Verificar si las notificaciones están activas según la configuración del Super Admin
    try {
      const { getTelegramConfig } = await import('../models/telegramConfigModel.js');
      const cfg = await getTelegramConfig();

      // Si el switch maestro está apagado, no enviar nada
      if (!cfg.activo) {
        import('../config/logger.js').then(({ logger }) => {
          logger.info('[TELEGRAM] Envío omitido: Notificaciones desactivadas por el Super Administrador.');
        }).catch(() => {});
        return;
      }

      // Validar por categoría específica
      if (categoria === 'resumen_diario' && !cfg.resumen_diario) return;
      if (categoria === 'alertas_admin' && !cfg.alertas_admin) return;
      if (categoria === 'alertas_errores' && !cfg.alertas_errores) return;
    } catch (cfgErr) {
      // Si falla la consulta de configuración, continuar normalmente
    }

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    });

    import('../config/logger.js').then(({ logger }) => {
      logger.info('[TELEGRAM] Mensaje enviado correctamente');
    }).catch(() => {});
  } catch (err) {
    import('../config/logger.js').then(({ logger }) => {
      logger.error(`[TELEGRAM_ERROR] Error enviando a la API de Telegram: ${err.message}`);
    }).catch(() => {});
  }
}
