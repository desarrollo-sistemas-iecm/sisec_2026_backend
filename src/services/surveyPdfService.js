// Generador de PDF de Encuestas Individuales 2027
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { resolveAccionFolderPath } from './fileUpload2027.js'

const LIKERT_MAP = {
  1: 'Totalmente en desacuerdo',
  2: 'En desacuerdo',
  3: 'Neutral / Regular',
  4: 'De acuerdo',
  5: 'Totalmente de acuerdo'
}

const PREGUNTAS = [
  { clave: 'P3', texto: 'La acción educativa cumplió con mis expectativas.' },
  { clave: 'P4', texto: 'Las personas que impartieron la acción educativa trataron el tema de forma clara.' },
  { clave: 'P5', texto: 'La temática abordada es aplicable a mi vida personal o laboral.' },
  { clave: 'P6', texto: 'El formato previsto para el desarrollo de la actividad motiva mi participación.' },
  { clave: 'P7', texto: 'Las dudas, inquietudes y comentarios fueron atendidos adecuadamente.' },
  { clave: 'P8', texto: '¿Consideras que esta actividad del IECM contribuye a la consolidación de la cultura democrática?' }
]

export const generateSurveyPdf = async ({
  id_distrito,
  folio_accion_educativa,
  folio_encuesta,
  consecutivo_encuesta,
  clave_accion,
  nombre_accion,
  edad,
  genero,
  respuestas, // { p3, p4, p5, p6, p7, p8 }
  fecha
}) => {
  return new Promise((resolve, reject) => {
    try {
      const folderPath = resolveAccionFolderPath(id_distrito, folio_accion_educativa)
      const encuestasFolder = path.join(folderPath, 'Encuestas')
      
      const cleanFecha = (fecha ? new Date(fecha) : new Date()).toISOString().slice(0, 10)
      const cleanClave = (clave_accion || 'AE').replace(/[^a-zA-Z0-9_-]/g, '_')
      const fileName = `E${consecutivo_encuesta || 1}-${cleanClave}-DD${id_distrito || 1}-${cleanFecha}.pdf`
      const filePath = path.join(encuestasFolder, fileName)

      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const writeStream = fs.createWriteStream(filePath)

      doc.pipe(writeStream)

      // ── ENCABEZADO INSTITUCIONAL ──────────────────────────────────
      doc.rect(40, 40, 515, 60).fill('#403166')
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
         .text('INSTITUTO ELECTORAL DE LA CIUDAD DE MÉXICO', 50, 52, { align: 'center', width: 495 })
      doc.fontSize(10).font('Helvetica')
         .text('Sistema de Seguimiento a Acciones de Educación Cívica (SISEC 2027)', 50, 72, { align: 'center', width: 495 })
      doc.text('CUESTIONARIO INDIVIDUAL DE SATISFACCIÓN', 50, 86, { align: 'center', width: 495 })

      doc.moveDown(3)

      // ── 1. DATOS DE IDENTIFICACIÓN ────────────────────────────────
      doc.fillColor('#403166').fontSize(11).font('Helvetica-Bold')
         .text('1. DATOS DE LA ACCIÓN EDUCATIVA', 40, 115)
      doc.strokeColor('#6B2D8B').lineWidth(1).moveTo(40, 130).lineTo(555, 130).stroke()

      doc.fillColor('#1E293B').fontSize(9).font('Helvetica')
      doc.text(`Folio de la Acción: `, 40, 140, { continued: true }).font('Helvetica-Bold').text(folio_accion_educativa || 'N/A')
      doc.font('Helvetica').text(`Folio de Encuesta: `, 320, 140, { continued: true }).font('Helvetica-Bold').text(folio_encuesta || 'N/A')
      
      doc.font('Helvetica').text(`Acción Educativa: `, 40, 155, { continued: true }).font('Helvetica-Bold').text(`${clave_accion || ''} - ${nombre_accion || ''}`)
      doc.font('Helvetica').text(`Distrito Electoral: `, 40, 170, { continued: true }).font('Helvetica-Bold').text(`Distrito ${id_distrito || 1}`)
      doc.font('Helvetica').text(`Fecha de Aplicación: `, 320, 170, { continued: true }).font('Helvetica-Bold').text(cleanFecha)

      // ── 2. PERFIL DEL PARTICIPANTE ────────────────────────────────
      doc.fillColor('#403166').fontSize(11).font('Helvetica-Bold')
         .text('2. PERFIL DE LA PERSONA ASISTENTE', 40, 195)
      doc.strokeColor('#6B2D8B').lineWidth(1).moveTo(40, 210).lineTo(555, 210).stroke()

      doc.fillColor('#1E293B').fontSize(9).font('Helvetica')
      doc.text(`Edad registrada: `, 40, 220, { continued: true }).font('Helvetica-Bold').text(`${edad || 'N/A'} años`)
      doc.font('Helvetica').text(`Género: `, 320, 220, { continued: true }).font('Helvetica-Bold').text(genero || 'No especificado')

      // ── 3. EVALUACIÓN DE SATISFACCIÓN ─────────────────────────────
      doc.fillColor('#403166').fontSize(11).font('Helvetica-Bold')
         .text('3. RESULTADOS DE LA EVALUACIÓN', 40, 245)
      doc.strokeColor('#6B2D8B').lineWidth(1).moveTo(40, 260).lineTo(555, 260).stroke()

      let yPos = 270
      PREGUNTAS.forEach((p, idx) => {
        const val = respuestas ? respuestas[p.clave.toLowerCase()] : null
        const valText = LIKERT_MAP[val] || 'Sin respuesta'

        // Fondo alternado para legibilidad
        if (idx % 2 === 0) {
          doc.rect(40, yPos - 3, 515, 28).fill('#F8FAFC')
        }

        doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold')
           .text(`${p.clave}.`, 45, yPos, { width: 25 })
        doc.font('Helvetica').text(p.texto, 70, yPos, { width: 340 })
        
        doc.fillColor('#6B2D8B').font('Helvetica-Bold')
           .text(`[ ${val || '-'} ] ${valText}`, 415, yPos, { width: 135, align: 'right' })

        yPos += 30
      })

      // ── 4. ÁREA DE VALIDACIÓN Y FIRMA ─────────────────────────────
      const firmaY = yPos + 35
      doc.fillColor('#403166').fontSize(10).font('Helvetica-Bold')
         .text('VALIDACIÓN INSTITUCIONAL', 40, firmaY)
      doc.strokeColor('#CBD5E1').lineWidth(0.8).moveTo(40, firmaY + 12).lineTo(555, firmaY + 12).stroke()

      // Espacio para firma
      doc.strokeColor('#94A3B8').lineWidth(1).dash(4, { space: 2 }).moveTo(160, firmaY + 65).lineTo(395, firmaY + 65).stroke().undash()
      doc.fillColor('#64748B').fontSize(8).font('Helvetica')
         .text('Firma o rúbrica de la persona asistente (opcional)', 160, firmaY + 70, { align: 'center', width: 235 })

      // Pie de página con código de verificación
      doc.fontSize(7).fillColor('#94A3B8')
         .text(`Documento generado electrónicamente por SISEC 2027 • Folio Único: ${folio_encuesta || 'N/A'} • Archivo: ${fileName}`, 40, 780, { align: 'center', width: 515 })

      doc.end()

      writeStream.on('finish', () => {
        resolve({
          fileName,
          filePath,
          relativeUrl: `/uploads/2027/DD${id_distrito || 1}/${(folio_accion_educativa || 'TEMP').replace(/[^a-zA-Z0-9_-]/g, '_')}/Encuestas/${fileName}`
        })
      })

      writeStream.on('error', (err) => {
        reject(err)
      })
    } catch (err) {
      reject(err)
    }
  })
}
