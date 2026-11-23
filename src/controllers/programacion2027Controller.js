// Controlador de Programación 2027
import { getCatalogosProgramacion2027 } from '../models/catalogos2027Model.js'
import {
  createAccionEducativa,
  listAccionesByDistrito,
  listAllAccionesAdmin,
  reprogramarAccion,
  cancelarAccion
} from '../models/accionesEducativasModel.js'
import { getIo } from '../socket.js'
import { logger } from '../config/logger.js'

export const getCatalogos2027Endpoint = async (req, res, next) => {
  try {
    const data = await getCatalogosProgramacion2027()
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[PROGRAMACION_2027] Error al obtener catálogos: ${error.message}`)
    return next(error)
  }
}

export const postProgramacion2027Endpoint = async (req, res, next) => {
  try {
    const {
      con_convenio,
      id_accion,
      id_vertiente,
      id_tipo_institucion,
      nombre_institucion,
      calle_numero,
      colonia,
      id_demarcacion,
      cp,
      grupo_poblacion_atendida,
      nombre_contacto,
      telefono_contacto,
      num_personas_atender,
      fecha_programada,
      hora_programada,
      nombre_cargo_persona_atendera
    } = req.body

    // Validaciones estrictas en Backend
    if (!id_accion) return res.status(400).json({ success: false, message: 'La acción educativa es obligatoria.' })
    if (!id_tipo_institucion) return res.status(400).json({ success: false, message: 'El tipo de institución o espacio es obligatorio.' })
    if (!nombre_institucion?.trim()) return res.status(400).json({ success: false, message: 'El nombre de la institución es obligatorio.' })
    if (!calle_numero?.trim()) return res.status(400).json({ success: false, message: 'La calle y número son obligatorios.' })
    if (!colonia?.trim()) return res.status(400).json({ success: false, message: 'La colonia es obligatoria.' })
    if (!id_demarcacion) return res.status(400).json({ success: false, message: 'La demarcación territorial es obligatoria.' })
    if (!cp || String(cp).trim().length !== 5) return res.status(400).json({ success: false, message: 'El código postal debe contener exactamente 5 dígitos.' })
    if (!nombre_contacto?.trim()) return res.status(400).json({ success: false, message: 'El nombre del contacto es obligatorio.' })
    if (!telefono_contacto?.trim()) return res.status(400).json({ success: false, message: 'El teléfono de contacto es obligatorio.' })
    if (!num_personas_atender || Number(num_personas_atender) <= 0 || Number(num_personas_atender) > 999) {
      return res.status(400).json({ success: false, message: 'El número de personas a atender debe ser de 1 a 3 dígitos (1-999).' })
    }
    if (!fecha_programada) return res.status(400).json({ success: false, message: 'La fecha programada es obligatoria.' })
    if (!hora_programada) return res.status(400).json({ success: false, message: 'La hora programada es obligatoria.' })
    if (!nombre_cargo_persona_atendera?.trim()) return res.status(400).json({ success: false, message: 'El nombre y cargo del personal que atenderá es obligatorio.' })

    const id_usuario = req.user?.idusuario || req.user?.id_usuario || 1
    const id_distrito = req.user?.idsede || req.user?.id_distrito || 1

    const idInsertado = await createAccionEducativa({
      con_convenio: !!con_convenio,
      id_accion: Number(id_accion),
      id_vertiente: Number(id_vertiente || 5),
      id_tipo_institucion: Number(id_tipo_institucion),
      nombre_institucion: nombre_institucion.trim(),
      calle_numero: calle_numero.trim(),
      colonia: colonia.trim(),
      id_demarcacion: Number(id_demarcacion),
      cp: String(cp).trim(),
      grupo_poblacion_atendida: grupo_poblacion_atendida?.trim() || null,
      nombre_contacto: nombre_contacto.trim(),
      telefono_contacto: telefono_contacto.trim(),
      num_personas_atender: Number(num_personas_atender),
      fecha_programada,
      hora_programada,
      nombre_cargo_persona_atendera: nombre_cargo_persona_atendera.trim(),
      id_usuario,
      id_distrito
    })

    // Emisión en tiempo real vía WebSockets
    try {
      const io = getIo()
      io.emit('accion:creada', {
        id_acciones_educativas: idInsertado,
        id_distrito,
        nombre_institucion,
        fecha_programada
      })
    } catch (wsErr) {
      logger.warn(`[WS] No se pudo emitir evento accion:creada: ${wsErr.message}`)
    }

    return res.status(201).json({
      success: true,
      message: 'Acción educativa programada exitosamente.',
      data: { id_acciones_educativas: idInsertado }
    })
  } catch (error) {
    logger.error(`[PROGRAMACION_2027] Error al guardar programación: ${error.message}`)
    return next(error)
  }
}

export const getAccionesDistritoEndpoint = async (req, res, next) => {
  try {
    const id_distrito = req.user?.idsede || req.user?.id_distrito || 1
    const data = await listAccionesByDistrito(id_distrito)
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[PROGRAMACION_2027] Error al listar acciones: ${error.message}`)
    return next(error)
  }
}

export const reprogramarAccionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const { fecha_programada, hora_programada } = req.body

    if (!fecha_programada || !hora_programada) {
      return res.status(400).json({ success: false, message: 'Fecha y hora son obligatorias para reprogramar.' })
    }

    await reprogramarAccion(id, fecha_programada, hora_programada)

    try {
      const io = getIo()
      io.emit('accion:reprogramada', { id_acciones_educativas: id, fecha_programada, hora_programada })
    } catch (wsErr) {
      // ignore
    }

    return res.json({ success: true, message: 'Acción educativa reprogramada exitosamente.' })
  } catch (error) {
    return next(error)
  }
}

export const cancelarAccionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const { motivo_cancelacion } = req.body

    if (!motivo_cancelacion?.trim()) {
      return res.status(400).json({ success: false, message: 'El motivo de cancelación es estrictamente obligatorio.' })
    }

    await cancelarAccion(id, motivo_cancelacion)

    try {
      const io = getIo()
      io.emit('accion:cancelada', { id_acciones_educativas: id, motivo_cancelacion })
    } catch (wsErr) {
      // ignore
    }

    return res.json({ success: true, message: 'La actividad ha sido cancelada correctamente.' })
  } catch (error) {
    return next(error)
  }
}

export const getAccionesAdminEndpoint = async (req, res, next) => {
  try {
    const { id_distrito, id_estado, fecha_desde, fecha_hasta } = req.query
    const data = await listAllAccionesAdmin({
      id_distrito: id_distrito ? Number(id_distrito) : undefined,
      id_estado: id_estado ? Number(id_estado) : undefined,
      fecha_desde,
      fecha_hasta
    })
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[PROGRAMACION_2027] Error al listar acciones admin: ${error.message}`)
    return next(error)
  }
}
