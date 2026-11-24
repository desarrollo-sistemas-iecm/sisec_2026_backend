// Uploads controller for SISEC CC 2026
import path from 'path'
import fs from 'fs'
import { env } from '../config/env.js'

import { getPool, getNewPool } from '../config/db.js'

export const descargarArchivo = (req, res) => {
  const { carpeta, sede, archivo } = req.params
  const filePath = path.resolve(env.uploadPath, carpeta, sede, archivo)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Archivo no encontrado.' })
  }

  return res.download(filePath)
}

/**
 * Sirve o descarga cualquier archivo anidado bajo la carpeta uploads con visualización inline
 */
export const descargarArchivoGenerico = (req, res, next) => {
  try {
    const rawParam = req.params.filepath || req.params[0] || ''
    const rawPath = Array.isArray(rawParam) ? rawParam.join('/') : String(rawParam)
    // Sanitización básica contra Path Traversal
    const safePath = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '')
    const uploadsBase = path.resolve(process.cwd(), env.uploadPath || './uploads')
    const filePath = path.join(uploadsBase, safePath)

    if (!filePath.startsWith(uploadsBase)) {
      return res.status(403).json({ success: false, message: 'Acceso no permitido a la ruta especificada.' })
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return res.status(404).json({ success: false, message: 'El archivo solicitado no existe en el servidor.' })
    }

    const ext = path.extname(filePath).toLowerCase()
    let contentType = 'application/octet-stream'
    if (ext === '.pdf') contentType = 'application/pdf'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.png') contentType = 'image/png'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`)
    return res.sendFile(filePath)
  } catch (error) {
    return next(error)
  }
}

export const descargarManual = async (req, res, next) => {
  try {
    const pool = await getNewPool()
    const result = await pool.request().query(`
      SELECT status FROM config_fechas_acceso WHERE tipo_alcance = 'manual'
    `)
    const habilitado = result.recordset.length > 0 ? Boolean(result.recordset[0].status) : false

    // Si no está habilitado y el usuario no es admin/superadmin (idpermiso >= 2), denegar
    const userPermiso = Number(req.user.permiso || req.user.idpermiso)
    if (!habilitado && userPermiso < 2) {
      return res.status(403).json({ success: false, message: 'El manual de usuario no está habilitado actualmente.' })
    }

    const filePath = path.resolve(env.uploadPath, 'Manual_SISEC_CC_2026.pdf')
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Archivo de manual no encontrado en el servidor.' })
    }

    return res.download(filePath, 'Manual_SISEC_CC_2026.pdf')
  } catch (error) {
    return next(error)
  }
}

