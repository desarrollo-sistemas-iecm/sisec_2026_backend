// Reportes controller for SISEC CC 2026 / 2027
import { getCatalogosReportes } from '../models/catalogoModel.js'
import {
  ejecutarReporte,
  getReporteAccionesEducativas,
  getReporteEncuestas,
  getReporteHistorico
} from '../models/reporteModel.js'
import {
  generarXLSX,
  generarExcelAcciones,
  generarExcelEncuestas,
  generarExcelHistorico
} from '../services/reporteGenerator.js'
import { logger, logQuery, logWarn, userTag } from '../config/logger.js'

// Tipos legados exclusivos para administrador (permiso 2)
const TIPOS_SOLO_ADMIN = [10, 11, 12, 13]

export const catalogosReportes = async (req, res, next) => {
  try {
    const data = await getCatalogosReportes()
    return res.json({ success: true, data })
  } catch (error) {
    return next(error)
  }
}

/**
 * Endpoint de Previsualización en Tiempo Real para Reportes 2027 e Histórico
 */
export const previewReporte = async (req, res, next) => {
  try {
    const permiso = Number(req.user?.permiso || 0)
    const tipo = String(req.body.tipo || '').toLowerCase()
    const idsede = Number(req.user?.idsede || req.user?.id_distrito || 1)

    const filtros = {
      tipo,
      distrito: Number(req.body.distrito || 0),
      fechaInic: req.body.fechaInic || null,
      fechaFin: req.body.fechaFin || null,
      permiso,
      idsede
    }

    if (tipo === 'acciones_educativas' || tipo === '101' || tipo === 'acciones') {
      const data = await getReporteAccionesEducativas(filtros)
      return res.json({ success: true, tipo: 'acciones_educativas', data })
    }

    if (tipo === 'encuestas' || tipo === '102') {
      const data = await getReporteEncuestas(filtros)
      return res.json({ success: true, tipo: 'encuestas', data })
    }

    if (tipo === 'historico' || tipo === '103') {
      const data = await getReporteHistorico(filtros)
      return res.json({ success: true, tipo: 'historico', data })
    }

    // Fallback hacia reporte legado
    const { titulo, columnas, filas } = await ejecutarReporte({
      ...filtros,
      tipo: Number(tipo) || 1
    })
    return res.json({
      success: true,
      tipo: 'legado',
      data: { titulo, columnas, registros: filas, resumen: { total: filas.length } }
    })
  } catch (error) {
    logger.error(`[REPORTES_PREVIEW] Error: ${error.message}`)
    return next(error)
  }
}

/**
 * Generación y Descarga de Archivo XLSX Formateado Oficial
 */
export const generarReporte = async (req, res, next) => {
  try {
    const permiso = Number(req.user?.permiso || 0)
    const rawTipo = req.body.tipo
    const tipoStr = String(rawTipo || '').toLowerCase()
    const idsede = Number(req.user?.idsede || req.user?.id_distrito || 1)

    const filtros = {
      tipo: rawTipo,
      vertiente: Number(req.body.vertiente || 0),
      criterio: req.body.criterio || '',
      distrito: Number(req.body.distrito || 0),
      delegacion: Number(req.body.delegacion || 0),
      convenio: Number(req.body.convenio || 0),
      taller: Number(req.body.taller || 0),
      fechaInic: req.body.fechaInic || null,
      fechaFin: req.body.fechaFin || null,
      permiso,
      idsede
    }

    const meta = {
      fechaInic: filtros.fechaInic,
      fechaFin: filtros.fechaFin,
      distrito: filtros.distrito > 0 ? `Distrito ${filtros.distrito}` : null
    }

    const hoy = new Date()
    const dd = String(hoy.getDate()).padStart(2, '0')
    const mm = String(hoy.getMonth() + 1).padStart(2, '0')
    const yyyy = hoy.getFullYear()
    const fechaStamp = `${dd}-${mm}-${yyyy}`

    // ── 1. REPORTE DE ACCIONES EDUCATIVAS 2027 ───────────────────────────────
    if (tipoStr === 'acciones_educativas' || tipoStr === '101' || tipoStr === 'acciones') {
      const { titulo, registros } = await getReporteAccionesEducativas(filtros)
      if (!registros || registros.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sin resultados de Acciones Educativas para los filtros seleccionados'
        })
      }
      const workbook = await generarExcelAcciones(titulo, registros, meta)
      const fileName = `Reporte_Acciones_Educativas_2027_${fechaStamp}.xlsx`

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      await workbook.xlsx.write(res)
      return res.end()
    }

    // ── 2. REPORTE DE ENCUESTAS DE SATISFACCIÓN 2027 ─────────────────────────
    if (tipoStr === 'encuestas' || tipoStr === '102') {
      const { titulo, registros } = await getReporteEncuestas(filtros)
      if (!registros || registros.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sin resultados de Encuestas para los filtros seleccionados'
        })
      }
      const workbook = await generarExcelEncuestas(titulo, registros, meta)
      const fileName = `Reporte_Encuestas_Satisfaccion_2027_${fechaStamp}.xlsx`

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      await workbook.xlsx.write(res)
      return res.end()
    }

    // ── 3. REPORTE HISTÓRICO DE TALLERES E INTERVENCIONES ────────────────────
    if (tipoStr === 'historico' || tipoStr === '103') {
      const { titulo, registros } = await getReporteHistorico(filtros)
      if (!registros || registros.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sin resultados históricos para los filtros seleccionados'
        })
      }
      const workbook = await generarExcelHistorico(titulo, registros, meta)
      const fileName = `Reporte_Historico_Talleres_Intervenciones_${fechaStamp}.xlsx`

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      await workbook.xlsx.write(res)
      return res.end()
    }

    // ── REPORTES LEGADOS (Tipos 1 a 14) ──────────────────────────────────────
    const tipoNum = Number(rawTipo)
    if (TIPOS_SOLO_ADMIN.includes(tipoNum) && permiso !== 2) {
      logWarn(`🚫 ACCESO DENEGADO ➜ Reporte no autorizado — Tipo: ${tipoNum} — ${userTag(req.user)}`)
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para generar este tipo de reporte.'
      })
    }

    const { titulo, columnas, filas, summaryRows = 0 } = await ejecutarReporte(filtros)

    if (!filas || filas.length === 0) {
      logWarn(`⚠️ REPORTE VACÍO ➜ Sin resultados — Tipo: ${tipoNum} — ${userTag(req.user)}`)
      return res.status(404).json({
        success: false,
        message: 'Sin resultados para los filtros seleccionados'
      })
    }

    const workbook = await generarXLSX(titulo, columnas, filas, meta, summaryRows)
    const fileName = `SISEC_${tipoNum}_${fechaStamp}.xlsx`

    logQuery(
      `📊 REPORTE GENERADO ➜ Tipo: ${tipoNum} | Registros: ${filas.length} — ${userTag(req.user)}`
    )

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    logger.error(`[REPORTES_GENERAR] Error: ${error.message}`)
    return next(error)
  }
}
