// File Upload Engine 2027
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { env } from '../config/env.js'

/**
 * Asegura la existencia de la ruta de carpetas
 */
export const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Resuelve la ruta física para los archivos de una acción educativa
 * Estructura: uploads/2027/DD{distrito}/{folio_accion}/
 */
export const resolveAccionFolderPath = (idDistrito, folioAccion) => {
  const distritoKey = `DD${parseInt(idDistrito || 1, 10)}`
  const cleanFolio = (folioAccion || 'TEMP_ACCION').replace(/[^a-zA-Z0-9_-]/g, '_')
  const folder = path.join(process.cwd(), env.uploadPath, '2027', distritoKey, cleanFolio)
  ensureDirectoryExists(folder)
  ensureDirectoryExists(path.join(folder, 'Encuestas'))
  return folder
}

/**
 * Almacenamiento Multer dinámico para evidencias 2027
 */
const storage2027 = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const idDistrito = req.user?.idsede || req.body?.id_distrito || 1
      const folioAccion = req.body?.folio_accion_educativa || req.params?.id || 'PENDIENTE'
      const folderPath = resolveAccionFolderPath(idDistrito, folioAccion)
      cb(null, folderPath)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    let prefix = 'archivo'
    if (file.fieldname === 'formato_registro_accion_pdf') prefix = 'FORMATO_1_REGISTRO'
    if (file.fieldname === 'formato_asistencia_accion_pdf') prefix = 'FORMATO_2_ASISTENCIA'
    if (file.fieldname === 'evidencia_fotografia') prefix = 'EVIDENCIA_FOTOGRAFICA'
    if (file.fieldname === 'encuesta_satisfaccion_pdf') prefix = 'ENCUESTAS_CONSOLIDADAS'

    const timestamp = Date.now()
    cb(null, `${prefix}_${timestamp}${ext}`)
  }
})

/**
 * Validador de tipos y límites: 10MB para formatos y foto, 20MB para consolidado de encuestas
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  if (file.fieldname === 'evidencia_fotografia') {
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      return cb(new Error('La evidencia fotográfica debe ser un archivo de imagen válido (.jpg o .png).'))
    }
  } else {
    if (ext !== '.pdf') {
      return cb(new Error('Los formatos y encuestas deben subirse exclusivamente en formato PDF.'))
    }
  }
  cb(null, true)
}

export const uploadEvidencias2027 = multer({
  storage: storage2027,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20 MB máx absoluto
  },
  fileFilter
})
