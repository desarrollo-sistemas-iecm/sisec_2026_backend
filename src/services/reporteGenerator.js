// XLSX report generator for SISEC CC 2026
import ExcelJS from 'exceljs'

const COLOR_TITULO   = 'FFFFFFFF'   // white
const COLOR_META     = 'FFFFFFFF'   // white
const COLOR_HEADER   = 'FF6B7280'   // gray-500
const COLOR_FILA_ALT = 'FFF9FAFB'   // gray-50
const COLOR_BORDE    = 'FFE5E7EB'   // gray-200
const COLOR_TOTALES  = 'FF4ADE80'   // vibrant green-400 (fila de totales)

function getContrastColor(hexColor) {
  const r = parseInt(hexColor.substr(0, 2), 16)
  const g = parseInt(hexColor.substr(2, 2), 16)
  const b = parseInt(hexColor.substr(4, 2), 16)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
  return (yiq >= 128) ? 'FF000000' : 'FFFFFFFF' // negro o blanco
}

/**
 * Genera un Workbook de ExcelJS con título, fila de metadata, cabeceras y datos.
 *
 * @param {string}   titulo      - Título del reporte (row 1)
 * @param {string[]} columnas    - Nombres de las columnas (row 3)
 * @param {Array[]}  datos       - Filas de datos (arrays de valores)
 * @param {object}   meta        - { fechaInic, fechaFin } para la fila de metadata
 * @param {number}   summaryRows - Últimas N filas son de totales (se estilan diferente)
 * @returns {ExcelJS.Workbook}
 */
export const generarXLSX = async (titulo, columnas, datos, meta = {}, summaryRows = 0) => {
  const workbook  = new ExcelJS.Workbook()
  workbook.creator   = 'SISEC CC 2026'
  workbook.created   = new Date()
  workbook.modified  = new Date()

  const worksheet = workbook.addWorksheet('Reporte', {
    pageSetup: { fitToPage: true, fitToWidth: 1, orientation: 'landscape' }
  })

  const numCols = columnas.length

  // ── Row 1: Título ──────────────────────────────────────────────────────────
  worksheet.mergeCells(1, 1, 1, numCols)
  const celdaTitulo = worksheet.getCell('A1')
  celdaTitulo.value     = titulo.toUpperCase()
  celdaTitulo.font      = { bold: true, size: 13, color: { argb: 'FF000000' }, name: 'Calibri' }
  celdaTitulo.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TITULO } }
  celdaTitulo.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 26

  // ── Row 2: Metadata (periodo + fecha generación) ───────────────────────────
  worksheet.mergeCells(2, 1, 2, numCols)
  const celdaMeta = worksheet.getCell('A2')
  const ahora     = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })

  let periodoText = ''
  if (meta.fechaInic && meta.fechaFin) {
    periodoText = `Periodo: ${meta.fechaInic} al ${meta.fechaFin}  |  `
  }
  celdaMeta.value     = `${periodoText}Generado el: ${ahora}`
  celdaMeta.font      = { italic: true, size: 9, color: { argb: 'FF4B5563' }, name: 'Calibri' }
  celdaMeta.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_META } }
  celdaMeta.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(2).height = 16

  // ── Row 3: Cabeceras ───────────────────────────────────────────────────────
  const filaCabecera = worksheet.addRow(columnas)
  filaCabecera.height = 20
  filaCabecera.eachCell((cell) => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border    = {
      bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
      right:  { style: 'thin', color: { argb: 'FFFFFFFF' } }
    }
  })

  const esDetalle = columnas.length === 21 && columnas[7] === 'Género'

  // ── Rows 4+: Datos ─────────────────────────────────────────────────────────
  const totalFilas = datos.length
  datos.forEach((fila, index) => {
    const esSummary   = summaryRows > 0 && index >= totalFilas - summaryRows
    const esAlternada = !esSummary && (esDetalle ? Math.floor(index / 2) % 2 === 0 : index % 2 === 0)

    const colorCurso = esDetalle ? fila[21] : null
    const filaDatos  = esDetalle ? fila.slice(0, 21) : fila

    const row = worksheet.addRow(filaDatos)
    row.height = 18 // un poco más alto para mejorar legibilidad

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (esSummary) {
        // ── Fila de totales: texto negro sobre fondo verde claro ───────
        cell.font      = { bold: true, size: 10, color: { argb: 'FF000000' }, name: 'Calibri' }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTALES } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border    = {
          top:    { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left:   { style: 'thin', color: { argb: 'FF000000' } },
          right:  { style: 'thin', color: { argb: 'FF000000' } }
        }
      } else {
        cell.font      = { size: 10, name: 'Calibri' }
        cell.alignment = { vertical: 'middle' }
        cell.border    = {
          top:    { style: 'thin', color: { argb: COLOR_BORDE } },
          bottom: { style: 'thin', color: { argb: COLOR_BORDE } },
          left:   { style: 'thin', color: { argb: COLOR_BORDE } },
          right:  { style: 'thin', color: { argb: COLOR_BORDE } }
        }
        if (esAlternada) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_FILA_ALT } }
        }
        // Alinear números al centro
        if (typeof filaDatos[colNumber - 1] === 'number') {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }

        // Pintar el fondo del número de fila (columna 1) con el color de curso asignado
        if (esDetalle && colNumber === 1 && colorCurso) {
          const cleanHex = colorCurso.substring(2)
          const textARGB = getContrastColor(cleanHex)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorCurso } }
          cell.font = { bold: true, size: 10, color: { argb: textARGB }, name: 'Calibri' }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      }
    })
  })

  // ── Combinación de celdas para reportes de detalle (M/H agrupados) ─────────
  if (esDetalle) {
    const numDatos = totalFilas - summaryRows
    for (let i = 0; i < numDatos; i += 2) {
      const rA = 4 + i
      const rB = 4 + i + 1

      const colsToMerge = [
        { col: 1, align: 'center' },  // Num
        { col: 2, align: 'center' },  // Distrito
        { col: 3, align: 'center' },  // ID
        { col: 4, align: 'left' },    // Taller o Intervención
        { col: 5, align: 'center' },  // Presencial
        { col: 6, align: 'center' },  // Virtual
        { col: 7, align: 'left' },    // Institución
        { col: 18, align: 'center' }, // Duración
        { col: 19, align: 'center' }, // Fecha
        { col: 20, align: 'left' },   // Comentarios
        { col: 21, align: 'center' }, // Convenio
      ]

      colsToMerge.forEach(({ col, align }) => {
        worksheet.mergeCells(rA, col, rB, col)
        const cell = worksheet.getCell(rA, col)
        cell.alignment = { vertical: 'middle', horizontal: align, wrapText: true }
      })
    }
  }

  // ── Anchos de columna (estimación por contenido) ───────────────────────────
  worksheet.columns.forEach((col, idx) => {
    // Tomar el header como referencia mínima
    const headerLen = (columnas[idx] || '').length
    let maxLen = Math.max(headerLen, 8)

    // Revisar las primeras 200 filas para estimar el ancho
    datos.slice(0, 200).forEach((fila) => {
      const val = fila[idx]
      if (val !== null && val !== undefined) {
        const len = String(val).length
        if (len > maxLen) maxLen = len
      }
    })

    col.width = Math.min(maxLen + 2, 40)   // máximo 40 chars
  })

  return workbook
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORTERS PARA REPORTES 2027 E HISTÓRICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Excel para Acciones Educativas / Afirmativas 2027 (con secciones divididas por colores)
 */
export const generarExcelAcciones = async (titulo, registros, meta = {}) => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SISEC CC 2026 / 2027'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Acciones Educativas', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }]
  })

  const totalCols = 33

  // Row 1: Título Principal
  worksheet.mergeCells(1, 1, 1, totalCols)
  const cellTit = worksheet.getCell('A1')
  cellTit.value = titulo.toUpperCase()
  cellTit.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
  cellTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B2D8B' } }
  cellTit.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 30

  // Row 2: Metadata
  worksheet.mergeCells(2, 1, 2, totalCols)
  const cellMeta = worksheet.getCell('A2')
  const ahora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
  const periodo = meta.fechaInic ? `Periodo: ${meta.fechaInic} al ${meta.fechaFin || meta.fechaInic}  |  ` : ''
  const distritoInfo = meta.distrito ? `Distrito: ${meta.distrito}  |  ` : 'Ámbito: Todos los Distritos  |  '
  cellMeta.value = `${distritoInfo}${periodo}Generado el: ${ahora}  |  Total registros: ${registros.length}`
  cellMeta.font = { italic: true, size: 9, color: { argb: 'FF475569' }, name: 'Calibri' }
  cellMeta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  cellMeta.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(2).height = 18

  // Row 3: Secciones de Encabezado por Categoría
  const sections = [
    { from: 1, to: 10, label: 'DATOS GENERALES DE LA ACCIÓN EDUCATIVA', color: 'FF6B2D8B' },
    { from: 11, to: 17, label: 'POBLACIÓN BENEFICIADA: MUJERES', color: 'FFDB2777' },
    { from: 18, to: 24, label: 'POBLACIÓN BENEFICIADA: HOMBRES', color: 'FF2563EB' },
    { from: 25, to: 28, label: 'OTRAS IDENTIDADES', color: 'FF7C3AED' },
    { from: 29, to: 29, label: 'TOTAL GENERAL', color: 'FF059669' },
    { from: 30, to: 33, label: 'EXPEDIENTE DIGITAL DE EVIDENCIAS', color: 'FF334155' }
  ]

  worksheet.getRow(3).height = 22
  sections.forEach(sec => {
    worksheet.mergeCells(3, sec.from, 3, sec.to)
    const cell = worksheet.getCell(3, sec.from)
    cell.value = sec.label
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.color } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Row 4: Columnas Específicas
  const colNames = [
    '#', 'Folio Oficial', 'Distrito', 'Acción Educativa', 'Institución / Lugar', 'Modalidad', 'Fecha Realización', 'Hora Programada', 'Duración Real', 'Estado',
    '0-12', '13-17', '18-29', '30-44', '45-59', '60+', 'Total M',
    '0-12', '13-17', '18-29', '30-44', '45-59', '60+', 'Total H',
    'No Binario', 'Otro', 'Pref. No Decir', 'Total Otras',
    'Total Asistentes',
    'Formato Registro', 'Evidencia Foto', 'Encuestas PDF', 'Encuestas Sistema'
  ]

  const filaCab = worksheet.addRow(colNames)
  filaCab.height = 24
  filaCab.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    // Asignar fondo según la sección
    const sec = sections.find(s => colNum >= s.from && colNum <= s.to)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec ? sec.color : 'FF475569' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    }
  })

  // Rows 5+: Registros
  let sumM = 0, sumH = 0, sumOtras = 0, sumTot = 0, sumEnc = 0
  registros.forEach((r, idx) => {
    sumM += (r.total_mujeres || 0)
    sumH += (r.total_hombres || 0)
    sumOtras += (r.total_otras || 0)
    sumTot += (r.total_general || 0)
    sumEnc += (r.total_encuestas_sistema || 0)

    const rowValues = [
      r.num,
      r.folio_accion_educativa,
      `DD${String(r.id_distrito).padStart(2, '0')}`,
      r.nombre_accion,
      r.nombre_institucion,
      r.modalidad_texto,
      r.fecha_realizacion,
      r.hora_programada,
      r.duracion_real,
      r.estado_texto,
      r.m_1, r.m_2, r.m_3, r.m_4, r.m_5, r.m_6, r.total_mujeres,
      r.h_1, r.h_2, r.h_3, r.h_4, r.h_5, r.h_6, r.total_hombres,
      r.total_no_binario, r.total_otro, r.total_pnd, r.total_otras,
      r.total_general,
      r.tiene_registro, r.tiene_foto, r.tiene_encuestas_pdf, r.total_encuestas_sistema
    ]

    const row = worksheet.addRow(rowValues)
    row.height = 19
    const esPar = idx % 2 === 0
    row.eachCell((cell, colNum) => {
      cell.font = { size: 9, name: 'Calibri' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
      if (esPar) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
      if (colNum === 1 || colNum === 3 || colNum === 6 || colNum === 7 || colNum === 8 || colNum === 9 || colNum === 10 || colNum >= 30) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else if (colNum >= 11 && colNum <= 29) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      }
    })
  })

  // Fila de Totales Generales
  const summaryValues = new Array(totalCols).fill('')
  summaryValues[0] = 'TOTALES'
  summaryValues[3] = `${registros.length} Acciones Educativas`
  summaryValues[16] = sumM
  summaryValues[23] = sumH
  summaryValues[27] = sumOtras
  summaryValues[28] = sumTot
  summaryValues[32] = sumEnc

  const rowTot = worksheet.addRow(summaryValues)
  rowTot.height = 22
  rowTot.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF065F46' }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF059669' } },
      bottom: { style: 'medium', color: { argb: 'FF059669' } }
    }
  })

  // Anchos automáticos
  worksheet.columns.forEach((col, idx) => {
    const headLen = (colNames[idx] || '').length
    col.width = Math.max(headLen + 3, 11)
  })
  worksheet.getColumn(4).width = 38 // Nombre Acción
  worksheet.getColumn(5).width = 28 // Institución

  return workbook
}

/**
 * 2. Excel para Encuestas de Satisfacción 2027 (ligadas a Acciones Educativas con colores)
 */
export const generarExcelEncuestas = async (titulo, registros, meta = {}) => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SISEC CC 2026 / 2027'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Encuestas de Satisfacción', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }]
  })

  const totalCols = 17

  // Row 1: Título
  worksheet.mergeCells(1, 1, 1, totalCols)
  const cellTit = worksheet.getCell('A1')
  cellTit.value = titulo.toUpperCase()
  cellTit.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
  cellTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
  cellTit.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 28

  // Row 2: Metadata
  worksheet.mergeCells(2, 1, 2, totalCols)
  const cellMeta = worksheet.getCell('A2')
  const ahora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
  const periodo = meta.fechaInic ? `Periodo: ${meta.fechaInic} al ${meta.fechaFin || meta.fechaInic}  |  ` : ''
  cellMeta.value = `${periodo}Generado el: ${ahora}  |  Total encuestas: ${registros.length}`
  cellMeta.font = { italic: true, size: 9, color: { argb: 'FF475569' }, name: 'Calibri' }
  cellMeta.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  cellMeta.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(2).height = 18

  // Row 3: Secciones por color
  const sections = [
    { from: 1, to: 4, label: 'ACCIÓN EDUCATIVA VINCULADA', color: 'FF6B2D8B' },
    { from: 5, to: 9, label: 'DATOS DE LA ENCUESTA Y ASISTENTE', color: 'FF2563EB' },
    { from: 10, to: 17, label: 'CALIFICACIÓN DE PREGUNTAS (1 A 5)', color: 'FF047857' }
  ]

  worksheet.getRow(3).height = 22
  sections.forEach(sec => {
    worksheet.mergeCells(3, sec.from, 3, sec.to)
    const cell = worksheet.getCell(3, sec.from)
    cell.value = sec.label
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec.color } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // Row 4: Columnas
  const colNames = [
    'Folio Acción Educativa', 'Distrito', 'Nombre Acción Educativa', 'Fecha Acción',
    'Folio Encuesta', 'Consecutivo', 'Edad', 'Género', 'Fecha Registro',
    'P3. Expectativas', 'P4. Claridad', 'P5. Materiales', 'P6. Utilidad', 'P7. Organización', 'P8. General',
    'Promedio', 'Nivel de Satisfacción'
  ]

  const filaCab = worksheet.addRow(colNames)
  filaCab.height = 24
  filaCab.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    const sec = sections.find(s => colNum >= s.from && colNum <= s.to)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: sec ? sec.color : 'FF475569' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    }
  })

  // Filas de datos
  let sumP3 = 0, sumP4 = 0, sumP5 = 0, sumP6 = 0, sumP7 = 0, sumP8 = 0, sumProm = 0
  registros.forEach((r, idx) => {
    sumP3 += (r.p3 || 0)
    sumP4 += (r.p4 || 0)
    sumP5 += (r.p5 || 0)
    sumP6 += (r.p6 || 0)
    sumP7 += (r.p7 || 0)
    sumP8 += (r.p8 || 0)
    sumProm += Number(r.promedio_satisfaccion || 0)

    const row = worksheet.addRow([
      r.folio_accion_educativa,
      `DD${String(r.id_distrito).padStart(2, '0')}`,
      r.nombre_accion,
      r.fecha_accion,
      r.folio_encuesta,
      r.consecutivo_encuesta,
      r.edad,
      r.genero,
      r.fecha_registro,
      r.p3, r.p4, r.p5, r.p6, r.p7, r.p8,
      Number(r.promedio_satisfaccion || 0),
      r.nivel_satisfaccion
    ])
    row.height = 19
    const esPar = idx % 2 === 0
    row.eachCell((cell, colNum) => {
      cell.font = { size: 9, name: 'Calibri' }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
      if (esPar) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
      if (colNum === 3) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })
  })

  // Fila de Promedios
  const n = registros.length
  if (n > 0) {
    const sumRow = new Array(totalCols).fill('')
    sumRow[0] = 'PROMEDIOS GENERALES'
    sumRow[2] = `${n} Encuestas evaluadas`
    sumRow[9] = (sumP3 / n).toFixed(2)
    sumRow[10] = (sumP4 / n).toFixed(2)
    sumRow[11] = (sumP5 / n).toFixed(2)
    sumRow[12] = (sumP6 / n).toFixed(2)
    sumRow[13] = (sumP7 / n).toFixed(2)
    sumRow[14] = (sumP8 / n).toFixed(2)
    sumRow[15] = (sumProm / n).toFixed(2)
    sumRow[16] = (sumProm / n) >= 4.0 ? 'Satisfactorio' : 'Por Mejorar'

    const rTot = worksheet.addRow(sumRow)
    rTot.height = 22
    rTot.eachCell((cell) => {
      cell.font = { bold: true, size: 9, color: { argb: 'FF065F46' }, name: 'Calibri' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF059669' } },
        bottom: { style: 'medium', color: { argb: 'FF059669' } }
      }
    })
  }

  // Anchos
  worksheet.columns.forEach((col, idx) => {
    const headLen = (colNames[idx] || '').length
    col.width = Math.max(headLen + 3, 12)
  })
  worksheet.getColumn(3).width = 38 // Nombre Acción
  worksheet.getColumn(1).width = 22 // Folio Acción
  worksheet.getColumn(5).width = 22 // Folio Encuesta

  return workbook
}

/**
 * 3. Excel para Reporte Histórico de Talleres e Intervenciones (sisecycc2024)
 * Formato estructurado oficial conforme a la plantilla requerida
 */
export const generarExcelHistorico = async (titulo, registros, meta = {}) => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SISEC CC 2026'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Histórico Talleres', {
    pageSetup: { fitToPage: true, orientation: 'landscape' },
    views: [{ state: 'frozen', xSplit: 4, ySplit: 3 }]
  })

  const totalCols = 21

  // Row 1: Título Principal
  worksheet.mergeCells(1, 1, 1, totalCols)
  const cellTit = worksheet.getCell('A1')
  cellTit.value = 'Reporte de Talleres e Intervenciones Educativas'
  cellTit.font = { bold: true, size: 13, color: { argb: 'FF1E293B' }, name: 'Calibri' }
  cellTit.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 26

  // Row 2: Metadata
  worksheet.mergeCells(2, 1, 2, totalCols)
  const cellMeta = worksheet.getCell('A2')
  const ahora = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
  const periodo = meta.fechaInic ? `Periodo: ${meta.fechaInic} al ${meta.fechaFin || meta.fechaInic}  |  ` : ''
  cellMeta.value = `${periodo}Generado el: ${ahora}  |  Registros: ${registros.length}`
  cellMeta.font = { italic: true, size: 9, color: { argb: 'FF64748B' }, name: 'Calibri' }
  cellMeta.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(2).height = 16

  // Row 3: Cabeceras Oficiales
  const colNames = [
    '#', 'DISTRI', 'ID', 'TALLER O INTERVENCIÓN', 'PRESENC', 'VIRTU', 'INSTITUCIÓN',
    'GÉNERO',
    '0-12', '13-16', '17-20', '21-30', '31-40', '41-50', '51-61', '>62', 'TOT',
    'DURACI', 'FECHA', 'COMENTAR', 'CONVEN'
  ]

  const filaCab = worksheet.addRow(colNames)
  filaCab.height = 22
  filaCab.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    if (colNum >= 9 && colNum <= 16) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
    } else if (colNum === 17) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
    } else {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
      right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
    }
  })

  // Rows 4+: 2 filas por actividad (Row M y Row H) con celdas combinadas
  let currentRow = 4
  const sumCols = new Array(9).fill(0) // 8 edades + 1 total

  registros.forEach((r, idx) => {
    const rM = [
      idx + 1,
      r.id_distrito,
      r.idcurso,
      r.curso,
      r.presencial,
      r.virtual,
      r.institucion,
      'M',
      r.m1, r.m2, r.m3, r.m4, r.m5, r.m6, r.m7, r.m8, r.total_m,
      r.duracion_formato,
      r.fecha,
      r.comentarios,
      r.convenio
    ]

    const rH = [
      idx + 1,
      r.id_distrito,
      r.idcurso,
      r.curso,
      r.presencial,
      r.virtual,
      r.institucion,
      'H',
      r.h1, r.h2, r.h3, r.h4, r.h5, r.h6, r.h7, r.h8, r.total_h,
      r.duracion_formato,
      r.fecha,
      r.comentarios,
      r.convenio
    ]

    // Acumular sumas
    for (let i = 0; i < 8; i++) {
      sumCols[i] += (r[`m${i+1}`] || 0) + (r[`h${i+1}`] || 0)
    }
    sumCols[8] += (r.total_general || 0)

    const rowObjM = worksheet.addRow(rM)
    const rowObjH = worksheet.addRow(rH)
    rowObjM.height = 18
    rowObjH.height = 18

    // Estilos
    const esPar = idx % 2 === 0
    const bgColor = esPar ? 'FFF8FAFC' : 'FFFFFFFF'

    rowObjM.eachCell((cell, colNum) => {
      cell.font = { size: 9, name: 'Calibri' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
      cell.alignment = colNum === 4 || colNum === 7 || colNum === 20
        ? { horizontal: 'left', vertical: 'middle' }
        : { horizontal: 'center', vertical: 'middle' }
    })

    rowObjH.eachCell((cell, colNum) => {
      cell.font = { size: 9, name: 'Calibri' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
      cell.alignment = colNum === 4 || colNum === 7 || colNum === 20
        ? { horizontal: 'left', vertical: 'middle' }
        : { horizontal: 'center', vertical: 'middle' }
    })

    // Celdas que se combinan verticalmente entre fila M y fila H:
    const colsToMerge = [
      { col: 1, align: 'center' },
      { col: 2, align: 'center' },
      { col: 3, align: 'center' },
      { col: 4, align: 'left' },
      { col: 5, align: 'center' },
      { col: 6, align: 'center' },
      { col: 7, align: 'left' },
      { col: 18, align: 'center' },
      { col: 19, align: 'center' },
      { col: 20, align: 'left' },
      { col: 21, align: 'center' }
    ]

    colsToMerge.forEach(({ col, align }) => {
      worksheet.mergeCells(currentRow, col, currentRow + 1, col)
      const mergedCell = worksheet.getCell(currentRow, col)
      mergedCell.alignment = { horizontal: align, vertical: 'middle', wrapText: true }
    })

    currentRow += 2
  })

  // Fila de Totales
  const summaryRow = new Array(totalCols).fill('')
  summaryRow[0] = 'TOTALES'
  summaryRow[3] = `${registros.length} Actividades`
  for (let i = 0; i < 9; i++) {
    summaryRow[8 + i] = sumCols[i]
  }

  const rTot = worksheet.addRow(summaryRow)
  rTot.height = 22
  rTot.eachCell((cell) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FF0F766E' }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFBF1' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F766E' } },
      bottom: { style: 'medium', color: { argb: 'FF0F766E' } }
    }
  })

  // Anchos
  worksheet.columns.forEach((col, idx) => {
    const headLen = (colNames[idx] || '').length
    col.width = Math.max(headLen + 3, 9)
  })
  worksheet.getColumn(4).width = 36 // Curso
  worksheet.getColumn(7).width = 24 // Institución
  worksheet.getColumn(20).width = 28 // Comentarios

  return workbook
}

