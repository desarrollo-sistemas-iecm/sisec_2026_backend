// Controlador de Notificaciones y Mensajes Predeterminados 2027
import {
  listMensajesPredeterminados,
  createMensajePredeterminado,
  enviarNotificacion2027,
  listNotificaciones2027,
  atenderNotificacion2027
} from '../models/notificaciones2027Model.js'
import { getIo } from '../socket.js'
import { logger } from '../config/logger.js'

export const getMensajesPredeterminadosEndpoint = async (req, res, next) => {
  try {
    const { tipo_flujo } = req.query
    const data = await listMensajesPredeterminados(tipo_flujo)
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[NOTIF_2027] Error al listar mensajes predeterminados: ${error.message}`)
    return next(error)
  }
}

export const postMensajePredeterminadoEndpoint = async (req, res, next) => {
  try {
    const { codigo, titulo, cuerpo_mensaje, tipo_flujo, categoria, requiere_id_accion, permite_comentario_adicional } = req.body

    if (!codigo || !titulo || !cuerpo_mensaje || !tipo_flujo) {
      return res.status(400).json({ success: false, message: 'Código, título, cuerpo y tipo de flujo son obligatorios.' })
    }

    const creado_por = req.user?.idusuario || req.user?.id_usuario || 1
    const id = await createMensajePredeterminado({
      codigo,
      titulo,
      cuerpo_mensaje,
      tipo_flujo,
      categoria,
      requiere_id_accion,
      permite_comentario_adicional,
      creado_por
    })

    return res.status(201).json({
      success: true,
      message: 'Mensaje predeterminado creado correctamente en el catálogo.',
      data: { id_mensaje_predeterminado: id }
    })
  } catch (error) {
    logger.error(`[NOTIF_2027] Error al crear mensaje predeterminado: ${error.message}`)
    return next(error)
  }
}

export const postEnviarNotificacionEndpoint = async (req, res, next) => {
  try {
    const {
      id_mensaje_predeterminado,
      id_acciones_educativas,
      id_usuario_destino,
      id_tipousuario_destino,
      titulo,
      mensaje_base,
      comentario_adicional
    } = req.body

    if (!titulo || !mensaje_base) {
      return res.status(400).json({ success: false, message: 'El título y el mensaje base son requeridos.' })
    }

    // El comentario adicional tiene un tope estricto de 100 caracteres
    const comentarioLimpio = String(comentario_adicional || '').trim().slice(0, 100)

    const id_usuario_origen = req.user?.idusuario || req.user?.id_usuario || 1
    const id_distrito_origen = req.user?.idsede || req.user?.id_distrito || null

    const idNotif = await enviarNotificacion2027({
      id_mensaje_predeterminado,
      id_usuario_origen,
      id_distrito_origen,
      id_usuario_destino,
      id_tipousuario_destino,
      id_acciones_educativas,
      titulo,
      mensaje_base,
      comentario_adicional: comentarioLimpio
    })

    // Emisión Socket.IO a salas correspondientes
    try {
      const io = getIo()
      const ahoraCDMX = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date()).replace(' ', 'T')

      const payloadWS = {
        id_mensaje: idNotif,
        id_distrito_origen,
        titulo,
        mensaje: `${mensaje_base}${comentarioLimpio ? ` — Nota: ${comentarioLimpio}` : ''}`,
        id_acciones_educativas,
        fecha: ahoraCDMX
      }

      if (id_tipousuario_destino === 2) {
        io.to('admins').emit('notificacion:nueva', payloadWS)
      } else if (id_tipousuario_destino === 3) {
        io.to('superadmins').emit('notificacion:nueva', payloadWS)
      } else if (id_usuario_destino) {
        io.to(`usuario_${id_usuario_destino}`).emit('notificacion:nueva', payloadWS)
      } else {
        io.to('admins').emit('notificacion:nueva', payloadWS)
      }
    } catch (wsErr) {
      logger.warn(`[WS] No se pudo emitir evento notificacion:nueva: ${wsErr.message}`)
    }

    // Despacho inmediato a Telegram si la notificación va dirigida al Super Administrador
    const esParaSuperadmin = Number(id_tipousuario_destino) === 3 || (!id_tipousuario_destino && !id_usuario_destino)
    if (esParaSuperadmin) {
      import('../services/telegram.service.js')
        .then(async ({ enviarMensajeAdminASuperadminTelegram }) => {
          let folio = null
          if (id_acciones_educativas) {
            try {
              const { getNewPool, sql } = await import('../config/db.js')
              const p = await getNewPool()
              const r = await p.request().input('id', sql.Int, id_acciones_educativas)
                .query('SELECT folio_accion_educativa FROM acciones_educativas WHERE id_acciones_educativas = @id')
              folio = r.recordset[0]?.folio_accion_educativa
            } catch (err) {}
          }

          const userRol = Number(req.user?.permiso || req.user?.id_tipousuario || 1) === 3
            ? 'Superadmin'
            : Number(req.user?.permiso || req.user?.id_tipousuario || 1) === 2
              ? 'Administrador'
              : 'Operador Distrital'

          await enviarMensajeAdminASuperadminTelegram({
            usuarioOrigen: req.user?.usuario || req.user?.nombre,
            nombreOrigen: req.user?.nombre_completo || req.user?.usuario,
            rolOrigen: userRol,
            distritoOrigen: id_distrito_origen,
            titulo,
            mensaje: mensaje_base,
            comentarioAdicional: comentarioLimpio,
            folioAccion: folio
          })
        })
        .catch(tErr => logger.warn(`[TELEGRAM] No se pudo enviar notificación de admin a superadmin: ${tErr.message}`))
    }

    return res.status(201).json({
      success: true,
      message: 'Notificación enviada correctamente.',
      data: { id_mensaje: idNotif }
    })
  } catch (error) {
    logger.error(`[NOTIF_2027] Error al enviar notificación: ${error.message}`)
    return next(error)
  }
}

export const getNotificacionesEndpoint = async (req, res, next) => {
  try {
    const id_distrito = req.user?.idsede || req.user?.id_distrito || null
    const id_tipousuario = req.user?.permiso || req.user?.idpermiso || 1
    const { estado } = req.query

    const data = await listNotificaciones2027({
      id_distrito: id_tipousuario === 1 ? id_distrito : null,
      id_tipousuario,
      estado
    })

    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[NOTIF_2027] Error al listar notificaciones: ${error.message}`)
    return next(error)
  }
}

export const postAtenderNotificacionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const { estado_solicitud, respuesta_admin } = req.body
    const id_admin = req.user?.idusuario || req.user?.id_usuario || 1

    await atenderNotificacion2027(id, estado_solicitud || 'ATENDIDA', respuesta_admin, id_admin)

    try {
      const io = getIo()
      io.emit('notificacion:atendida', { id_mensaje: id, estado_solicitud, respuesta_admin })
    } catch (wsErr) {
      // ignore
    }

    return res.json({ success: true, message: 'La notificación ha sido actualizada.' })
  } catch (error) {
    return next(error)
  }
}
