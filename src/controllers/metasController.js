// Controlador de Metas Institucionales y Recordatorios 2027
import {
  listMetas,
  upsertMeta,
  updateMetaAmount,
  listRecordatorios,
  upsertRecordatorio,
  dispararRecordatorio,
  getMetasDashboardStats
} from '../models/metasModel.js'
import { getIo } from '../socket.js'
import { logger } from '../config/logger.js'

export const getMetasEndpoint = async (req, res, next) => {
  try {
    const anio = req.query.anio ? Number(req.query.anio) : 2027
    const data = await listMetas(anio)
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[METAS] Error al obtener metas: ${error.message}`)
    return next(error)
  }
}

export const postMetaEndpoint = async (req, res, next) => {
  try {
    const { anio, id_distrito, meta_anual, descripcion } = req.body
    const idUsuario = req.user?.idusuario || req.user?.id_usuario || 1

    if (!meta_anual) {
      return res.status(400).json({ success: false, message: 'La cantidad de la meta es obligatoria.' })
    }

    const result = await upsertMeta({ anio, id_distrito, meta_anual, descripcion }, idUsuario)
    return res.status(201).json({
      success: true,
      message: result.action === 'created' ? 'Meta institucional creada con éxito.' : 'Meta institucional actualizada.',
      data: result
    })
  } catch (error) {
    logger.error(`[METAS] Error al guardar meta: ${error.message}`)
    return next(error)
  }
}

export const putMetaEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const { meta_anual, descripcion } = req.body
    const idUsuario = req.user?.idusuario || req.user?.id_usuario || 1

    if (!meta_anual) {
      return res.status(400).json({ success: false, message: 'La nueva cantidad de meta es obligatoria.' })
    }

    await updateMetaAmount(id, meta_anual, descripcion, idUsuario)
    return res.json({
      success: true,
      message: 'Cantidad de la meta actualizada correctamente.'
    })
  } catch (error) {
    logger.error(`[METAS] Error al actualizar meta: ${error.message}`)
    return next(error)
  }
}

export const getRecordatoriosEndpoint = async (req, res, next) => {
  try {
    const data = await listRecordatorios()
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[METAS] Error al listar recordatorios: ${error.message}`)
    return next(error)
  }
}

export const postRecordatorioEndpoint = async (req, res, next) => {
  try {
    const payload = req.body
    const idUsuario = req.user?.idusuario || req.user?.id_usuario || 1

    if (!payload.mensaje) {
      return res.status(400).json({ success: false, message: 'El contenido del mensaje es requerido.' })
    }

    const result = await upsertRecordatorio(payload, idUsuario)
    return res.status(201).json({
      success: true,
      message: result.action === 'created' ? 'Recordatorio programado con éxito.' : 'Recordatorio actualizado.',
      data: result
    })
  } catch (error) {
    logger.error(`[METAS] Error al guardar recordatorio: ${error.message}`)
    return next(error)
  }
}

export const postDispararRecordatorioEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const idUsuario = req.user?.idusuario || req.user?.id_usuario || 1

    const result = await dispararRecordatorio(id, idUsuario)

    // Emitir por Socket.IO a todos los distritos conectados
    try {
      const io = getIo()
      const payloadWS = {
        titulo: result.titulo,
        mensaje: result.mensaje,
        tipo: 'RECORDATORIO_META',
        fecha: new Date().toISOString()
      }
      if (result.id_distrito_destino === 0) {
        io.emit('notificacion:recordatorio_meta', payloadWS)
      } else {
        io.to(`distrito_${result.id_distrito_destino}`).emit('notificacion:recordatorio_meta', payloadWS)
      }
    } catch (wsErr) {
      logger.warn(`[WS] No se pudo emitir evento recordatorio_meta: ${wsErr.message}`)
    }

    return res.json({
      success: true,
      message: `Recordatorio disparado exitosamente a ${result.id_distrito_destino === 0 ? 'todas las Direcciones Distritales' : `la Dirección Distrital ${result.id_distrito_destino}`}.`,
      data: result
    })
  } catch (error) {
    logger.error(`[METAS] Error al disparar recordatorio: ${error.message}`)
    return next(error)
  }
}

export const getMetasDashboardStatsEndpoint = async (req, res, next) => {
  try {
    const { anio, id_distrito } = req.query
    const stats = await getMetasDashboardStats({
      anio: anio ? Number(anio) : 2027,
      id_distrito: id_distrito !== undefined && id_distrito !== '' ? Number(id_distrito) : null
    })
    return res.json({ success: true, data: stats })
  } catch (error) {
    logger.error(`[METAS] Error al obtener estadísticas de metas: ${error.message}`)
    return next(error)
  }
}
