// Controlador de Captura, Evidencias y Encuestas 2027
import path from 'path'
import fs from 'fs'
import { env } from '../config/env.js'
import { getNewPool, sql } from '../config/db.js'
import { getCapturaByAccion, guardarCapturaInicial, finalizarAccion } from '../models/captura2027Model.js'
import { registrarEncuesta2027, listEncuestasPorAccion } from '../models/encuestas2027Model.js'
import { getIo } from '../socket.js'
import { logger } from '../config/logger.js'

/**
 * Función auxiliar para localizar un archivo recursivamente en uploads
 */
const findFileRecursively = (dir, target) => {
  if (!fs.existsSync(dir)) return null
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const found = findFileRecursively(fullPath, target)
        if (found) return found
      } else if (entry.name === target) {
        return fullPath
      }
    }
  } catch (err) {
    // ignorar errores de lectura de directorio
  }
  return null
}

export const getCapturaDetailEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const captura = await getCapturaByAccion(id)
    return res.json({ success: true, data: captura })
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al obtener detalle de captura: ${error.message}`)
    return next(error)
  }
}

export const postGuardarCapturaEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const id_distrito = req.user?.idsede || req.user?.id_distrito || 1

    const files = req.files || {}
    const filenames = {
      formato_registro_accion_pdf: files.formato_registro_accion_pdf?.[0]?.filename || null,
      formato_asistencia_accion_pdf: files.formato_asistencia_accion_pdf?.[0]?.filename || null,
      evidencia_fotografia: files.evidencia_fotografia?.[0]?.filename || null
    }

    const result = await guardarCapturaInicial(id, req.body, filenames, id_distrito)

    // Notificación Socket.IO en tiempo real
    try {
      const io = getIo()
      io.emit('accion:capturada', {
        id_acciones_educativas: id,
        folio_accion_educativa: result.folio_accion_educativa,
        id_distrito,
        id_estado: 2,
        estado_accion: 'Capturada'
      })
    } catch (wsErr) {
      // ignore
    }

    return res.json({
      success: true,
      message: 'Información y evidencias guardadas correctamente. Folio de Acción asignado.',
      data: result
    })
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al guardar captura: ${error.message}`)
    return next(error)
  }
}

export const postFinalizarAccionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const files = req.files || {}
    const encuestaPdf = files.encuesta_satisfaccion_pdf?.[0]?.filename

    if (!encuestaPdf) {
      return res.status(400).json({
        success: false,
        message: 'Para finalizar la acción educativa es obligatorio subir el archivo PDF consolidado de Encuestas de Satisfacción (Archivo 4).'
      })
    }

    const result = await finalizarAccion(id, encuestaPdf)

    // Notificación Socket.IO
    try {
      const io = getIo()
      io.emit('accion:finalizada', {
        id_acciones_educativas: id,
        id_estado: 3,
        estado_accion: 'Finalizada'
      })
    } catch (wsErr) {
      // ignore
    }

    return res.json({
      success: true,
      message: '¡Acción educativa finalizada con éxito! El expediente ha sido cerrado para edición.',
      data: result
    })
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al finalizar acción: ${error.message}`)
    return next(error)
  }
}

export const postEncuestaAccionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const id_distrito = req.user?.idsede || req.user?.id_distrito || 1

    const {
      folio_accion_educativa,
      clave_accion,
      nombre_accion,
      tipo_encuesta,
      p1_edad_persona_asistente,
      id_genero,
      genero_texto,
      p3, p4, p5, p6, p7, p8
    } = req.body

    if (!p1_edad_persona_asistente || Number(p1_edad_persona_asistente) < 1 || Number(p1_edad_persona_asistente) > 120) {
      return res.status(400).json({ success: false, message: 'La edad de la persona asistente debe ser un número válido entre 1 y 120.' })
    }
    if (!id_genero) {
      return res.status(400).json({ success: false, message: 'El género de la persona asistente es obligatorio.' })
    }
    if (!p3 || !p4 || !p5 || !p6 || !p7 || !p8) {
      return res.status(400).json({ success: false, message: 'Todas las preguntas del cuestionario de satisfacción son obligatorias.' })
    }

    const regResult = await registrarEncuesta2027({
      id_acciones_educativas: Number(id),
      folio_accion_educativa,
      tipo_encuesta,
      p1_edad_persona_asistente,
      id_genero,
      p3, p4, p5, p6, p7, p8
    })

    // Socket.IO broadcast
    try {
      const io = getIo()
      io.emit('encuesta:registrada', {
        id_acciones_educativas: id,
        folio_accion_educativa,
        folio_encuesta: regResult.folio_encuesta,
        consecutivo: regResult.consecutivo_encuesta
      })
    } catch (wsErr) {
      // ignore
    }

    return res.status(201).json({
      success: true,
      message: `Encuesta registrada con éxito (Consecutivo ${regResult.consecutivo_encuesta}).`,
      data: regResult
    })
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al registrar encuesta: ${error.message}`)
    return next(error)
  }
}

export const getEncuestasAccionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const rol = Number(req.user?.permiso || req.user?.idpermiso || req.user?.id_tipousuario || 1)
    const isPrivileged = rol >= 2

    // Si no es admin ni superadmin, validar que la acción pertenezca estrictamente a su distrito
    if (!isPrivileged) {
      const userDistrito = Number(req.user?.idsede || req.user?.id_distrito || 0)
      const pool = await getNewPool()
      const checkReq = pool.request()
      checkReq.input('id', sql.Int, Number(id))
      const checkRes = await checkReq.query(`
        SELECT u.id_distrito
        FROM acciones_educativas ae
        INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
        WHERE ae.id_acciones_educativas = @id
      `)
      if (checkRes.recordset.length > 0) {
        const accionDistrito = Number(checkRes.recordset[0].id_distrito)
        if (accionDistrito !== userDistrito) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permiso para consultar las encuestas de otro órgano distrital.'
          })
        }
      }
    }

    const data = await listEncuestasPorAccion(id)
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al listar encuestas de la acción: ${error.message}`)
    return next(error)
  }
}

export const getArchivoCapturaEndpoint = async (req, res, next) => {
  try {
    const { id, tipo } = req.params
    const captura = await getCapturaByAccion(id)
    if (!captura) {
      return res.status(404).json({ success: false, message: 'Expediente no encontrado.' })
    }

    let fieldName = null
    const tipoStr = String(tipo).toLowerCase()

    if (tipoStr === '1' || tipoStr === 'archivo1' || tipoStr === 'formato_registro_accion_pdf' || tipoStr === 'registro') {
      fieldName = 'formato_registro_accion_pdf'
    } else if (tipoStr === '2' || tipoStr === 'archivo2' || tipoStr === 'formato_asistencia_accion_pdf' || tipoStr === 'asistencia') {
      fieldName = 'formato_asistencia_accion_pdf'
    } else if (tipoStr === '3' || tipoStr === 'archivo3' || tipoStr === 'evidencia_fotografia' || tipoStr === 'foto' || tipoStr === 'fotografia') {
      fieldName = 'evidencia_fotografia'
    } else if (tipoStr === '4' || tipoStr === 'archivo4' || tipoStr === 'encuesta_satisfaccion_pdf' || tipoStr === 'encuesta' || tipoStr === 'encuestas') {
      fieldName = 'encuesta_satisfaccion_pdf'
    }

    if (!fieldName) {
      return res.status(400).json({ success: false, message: 'Tipo de archivo no válido.' })
    }

    const filename = captura[fieldName]
    if (!filename) {
      return res.status(404).json({ success: false, message: 'El archivo solicitado no se encuentra adjunto en este expediente.' })
    }

    const uploadsBase = path.resolve(process.cwd(), env.uploadPath || './uploads')
    const filePath = findFileRecursively(uploadsBase, filename)

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: `El archivo físico '${filename}' no fue localizado en el servidor.` })
    }

    const ext = path.extname(filePath).toLowerCase()
    let contentType = 'application/octet-stream'
    if (ext === '.pdf') contentType = 'application/pdf'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.png') contentType = 'image/png'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`)
    return res.sendFile(path.resolve(filePath))
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al servir archivo de captura: ${error.message}`)
    return next(error)
  }
}
