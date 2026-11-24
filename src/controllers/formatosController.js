// Formatos controller for SISEC CC 2026 / 2027
import fs from 'fs'
import path from 'path'
import { getBasePath, loadFormatosConfig } from './adminFormatosController.js'

// Listar formatos oficiales activos para usuarios distritales
export const listFormatos = (req, res) => {
  try {
    const basePath = getBasePath()
    const serverFiles = fs.readdirSync(basePath)
      .filter(file => fs.statSync(path.join(basePath, file)).isFile())

    const config = loadFormatosConfig()

    // Filtrar solo categorías activas y dentro de ellas formatos activos
    const categoriasActivas = (config.categorias || [])
      .filter(cat => cat.activo !== false)
      .map(cat => ({
        id: cat.id,
        nombre: cat.nombre,
        tag: cat.tag,
        archivos: (cat.archivos || []).filter(f => f.activo !== false && serverFiles.includes(f.archivo))
      }))
      .filter(cat => cat.archivos.length > 0)

    return res.json({ success: true, data: categoriasActivas })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al listar formatos disponibles' })
  }
}

// Descarga segura de formato oficial
export const downloadFormato = (req, res) => {
  const { archivo } = req.params

  // Validación anti path traversal y extensiones documentales
  const safeNameRegex = /^[a-zA-Z0-9_\-\.]+\.(docx|doc|pdf|xlsx|xls)$/i
  if (!safeNameRegex.test(archivo)) {
    return res.status(400).json({ success: false, message: 'Nombre de archivo inválido.' })
  }

  const basePath = getBasePath()
  const filePath = path.resolve(basePath, archivo)

  // Extra validación: asegurarse de que no escapó el directorio base
  if (!filePath.startsWith(path.resolve(basePath))) {
    return res.status(403).json({ success: false, message: 'Acceso denegado.' })
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Archivo no encontrado' })
  }

  res.download(filePath, archivo, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error al descargar el archivo' })
      }
    }
  })
}
