// Controlador de Captura, Evidencias y Encuestas 2027
import { getCapturaByAccion, guardarCapturaInicial, finalizarAccion } from '../models/captura2027Model.js'
import { registrarEncuesta2027, listEncuestasPorAccion } from '../models/encuestas2027Model.js'
import { generateSurveyPdf } from '../services/surveyPdfService.js'
import { getIo } from '../socket.js'
import { logger } from '../config/logger.js'

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

    // Generar PDF individual limpio sin firma de la encuesta
    let pdfData = null
    try {
      pdfData = await generateSurveyPdf({
        id_distrito,
        folio_accion_educativa,
        folio_encuesta: regResult.folio_encuesta,
        consecutivo_encuesta: regResult.consecutivo_encuesta,
        clave_accion,
        nombre_accion,
        edad: p1_edad_persona_asistente,
        genero: genero_texto,
        respuestas: { p3, p4, p5, p6, p7, p8 },
        fecha: new Date()
      })
    } catch (pdfErr) {
      logger.warn(`[PDF_GENERATOR] No se pudo generar PDF individual de encuesta: ${pdfErr.message}`)
    }

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
      data: {
        ...regResult,
        pdf: pdfData
      }
    })
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al registrar encuesta: ${error.message}`)
    return next(error)
  }
}

export const getEncuestasAccionEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params
    const data = await listEncuestasPorAccion(id)
    return res.json({ success: true, data })
  } catch (error) {
    logger.error(`[CAPTURA_2027] Error al listar encuestas de la acción: ${error.message}`)
    return next(error)
  }
}
