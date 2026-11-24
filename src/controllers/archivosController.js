import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { env } from '../config/env.js'
import { crearNotificacion } from '../models/notificacionModel.js'
import { getNewPool, getPool, sql } from '../config/db.js'
import { zipFolder } from '../utils/zipUtil.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Directorio raíz oficial del explorador: fijado estrictamente en la carpeta '2027'
const getBase2027Dir = async () => {
  let dir2027 = path.resolve(__dirname, '../../uploads/2027')
  if (!fsSync.existsSync(dir2027)) {
    const cwd2027 = path.resolve(process.cwd(), env.uploadPath, '2027')
    if (fsSync.existsSync(cwd2027)) dir2027 = cwd2027
  }
  try {
    await fs.mkdir(dir2027, { recursive: true })
  } catch (e) {
    // Si ya existe continúa
  }
  return dir2027
}

// Limpiar prefijo '2027' para evitar duplicidad de ruta
const sanitizePath = (p = '') => {
  return String(p || '')
    .replace(/^[\\\/]*2027([\\\/]|$)/i, '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

// Registro en bitácora de archivos de seguridad 2027
const registrarBitacoraArchivo = async ({ id_usuario, accion, ruta_archivo, nombre_archivo, motivo, ip_origen }) => {
  try {
    const pool = await getNewPool()
    const checkTable = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'bitacora_archivos'
    `)
    if (checkTable.recordset.length > 0) {
      const req = pool.request()
      req.input('id_usuario', sql.Int, id_usuario || 1)
      req.input('accion', sql.VarChar(50), accion)
      req.input('ruta_archivo', sql.VarChar(300), ruta_archivo)
      req.input('nombre_archivo', sql.VarChar(150), nombre_archivo)
      req.input('motivo', sql.VarChar(250), motivo || 'Eliminación autorizada con confirmación de seguridad')
      req.input('ip_origen', sql.VarChar(45), ip_origen || '127.0.0.1')
      await req.query(`
        INSERT INTO bitacora_archivos (id_usuario, accion, ruta_archivo, nombre_archivo, motivo, ip_origen, fecha)
        VALUES (@id_usuario, @accion, @ruta_archivo, @nombre_archivo, @motivo, @ip_origen, GETDATE())
      `)
    }
  } catch (err) {
    console.warn('[BITACORA_ARCHIVOS] No se pudo insertar registro:', err.message)
  }
}

// Navegación de directorios con raíz fijada en 2027
export const getArchivosTree = async (req, res, next) => {
  try {
    const { folder = '' } = req.query
    const baseDir = await getBase2027Dir()
    const cleanFolder = sanitizePath(folder)
    const targetDir = path.resolve(baseDir, cleanFolder)

    // Seguridad: prevenir Path Traversal
    if (!targetDir.startsWith(baseDir)) {
      return res.status(403).json({ success: false, message: 'Ruta no permitida' })
    }

    let entries = []
    try {
      entries = await fs.readdir(targetDir, { withFileTypes: true })
    } catch (e) {
      // Directorio no existe o vacío
      entries = []
    }

    const items = []
    for (const entry of entries) {
      const isDir = entry.isDirectory()
      let size = 0
      let modified = null
      
      if (!isDir) {
        try {
          const stats = await fs.stat(path.join(targetDir, entry.name))
          size = stats.size
          modified = stats.mtime
        } catch (e) {}
      }

      items.push({
        name: entry.name,
        isDir,
        path: path.join(cleanFolder, entry.name).replace(/\\/g, '/'),
        size,
        modified
      })
    }

    // Ordenar carpetas primero
    items.sort((a, b) => {
      if (a.isDir === b.isDir) return a.name.localeCompare(b.name)
      return a.isDir ? -1 : 1
    })

    return res.json({ success: true, data: items })
  } catch (error) {
    return next(error)
  }
}

export const deleteArchivo = async (req, res, next) => {
  try {
    const { filepath, confirmationWord, motivo } = req.body
    const baseDir = await getBase2027Dir()
    const cleanPath = sanitizePath(filepath)
    const targetPath = path.resolve(baseDir, cleanPath)

    if (!targetPath.startsWith(baseDir)) {
      return res.status(403).json({ success: false, message: 'Ruta no permitida' })
    }

    // Reto de seguridad: Validar que se haya escrito la palabra ELIMINAR
    if (String(confirmationWord || '').trim().toUpperCase() !== 'ELIMINAR') {
      return res.status(400).json({
        success: false,
        message: 'Reto de seguridad no superado. Debes escribir la palabra exacta "ELIMINAR" para desbloquear la eliminación.'
      })
    }

    await fs.unlink(targetPath)

    // Auditoría en bitácora de archivos 2027
    const idUsuario = req.user?.idusuario || req.user?.id_usuario || 1
    const ipOrigen = req.ip || req.connection?.remoteAddress || '127.0.0.1'
    await registrarBitacoraArchivo({
      id_usuario: idUsuario,
      accion: 'ELIMINACION',
      ruta_archivo: `2027/${cleanPath}`,
      nombre_archivo: path.basename(cleanPath),
      motivo: motivo || 'Eliminación manual por reto de seguridad superado',
      ip_origen: ipOrigen
    })

    // Notificación en sistema
    await crearNotificacion({
      tipo: 'archivo_actualizado',
      titulo: 'Archivo eliminado por administrador',
      mensaje: `El archivo ${path.basename(cleanPath)} ha sido eliminado por el usuario ID ${idUsuario}.`,
      idsede_origen: 0,
      idsede_destino: 0,
      idusuario_destino: 0
    })

    return res.json({ success: true, message: 'Archivo eliminado y registrado en la bitácora de auditoría correctamente.' })
  } catch (error) {
    return next(error)
  }
}

export const replaceArchivo = async (req, res, next) => {
  try {
    const { filepath } = req.body
    const file = req.files?.archivo?.[0]

    if (!file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó archivo de reemplazo' })
    }

    const baseDir = await getBase2027Dir()
    const cleanPath = sanitizePath(filepath)
    const targetPath = path.resolve(baseDir, cleanPath)

    if (!targetPath.startsWith(baseDir)) {
      // Eliminar el temp file
      await fs.unlink(file.path)
      return res.status(403).json({ success: false, message: 'Ruta no permitida' })
    }

    // Sobrescribir (Mover el archivo subido al targetPath)
    await fs.copyFile(file.path, targetPath)
    await fs.unlink(file.path)

    await crearNotificacion({
      tipo: 'archivo_actualizado',
      titulo: 'Archivo reemplazado por administrador',
      mensaje: `El archivo ${path.basename(cleanPath)} ha sido actualizado en sistema.`,
      idsede_origen: 0,
      idsede_destino: 0,
      idusuario_destino: 0
    })

    return res.json({ success: true, message: 'Archivo reemplazado exitosamente' })
  } catch (error) {
    return next(error)
  }
}

/**
 * Descarga comprimida en ZIP de cualquier carpeta (Concentrado Total 2027, Distritos o Acciones)
 */
export const downloadFolderZip = async (req, res, next) => {
  try {
    const { folder = '' } = req.query
    const baseDir = await getBase2027Dir()
    const cleanFolder = sanitizePath(folder)
    const targetDir = path.resolve(baseDir, cleanFolder)

    // Prevenir Path Traversal
    if (!targetDir.startsWith(baseDir)) {
      return res.status(403).json({ success: false, message: 'Ruta no permitida' })
    }

    try {
      const stats = await fs.stat(targetDir)
      if (!stats.isDirectory()) {
        return res.status(400).json({ success: false, message: 'La ruta indicada no es un directorio.' })
      }
    } catch (e) {
      return res.status(404).json({ success: false, message: 'La carpeta solicitada no existe o está vacía.' })
    }

    // Nombre dinámico y descriptivo del archivo ZIP según el nivel jerárquico dentro de 2027
    let zipName = 'ARCHIVOS_2027.zip'

    if (cleanFolder === '') {
      // Estamos en la raíz 2027 -> Concentrado total de todos los distritos
      zipName = 'CONCENTRADO_TOTAL_DISTRITOS_2027.zip'
    } else if (/^DD\d+$/i.test(cleanFolder)) {
      // Estamos en un distrito específico (ej. DD1)
      const dd = cleanFolder.toUpperCase()
      zipName = `ACCIONES_EDUCATIVAS_${dd}_2027.zip`
    } else if (/^DD\d+\/AE-/i.test(cleanFolder)) {
      // Estamos dentro de una acción específica (ej. DD1/AE-DD01-2027-0001)
      const parts = cleanFolder.split('/')
      zipName = `EXPEDIENTE_${parts[1].toUpperCase()}.zip`
    } else if (cleanFolder) {
      const lastSegment = path.basename(cleanFolder).toUpperCase()
      zipName = `EXPEDIENTE_${lastSegment}.zip`
    }

    // Archivo temporal
    const tempZipPath = path.join(os.tmpdir(), `sicec_${Date.now()}_${Math.random().toString(36).substring(7)}.zip`)

    // Generar compresión ultra-rápida nativa
    await zipFolder(targetDir, tempZipPath)

    // Enviar al cliente
    res.download(tempZipPath, zipName, async (err) => {
      try {
        await fs.unlink(tempZipPath)
      } catch (unlinkErr) {
        // ignore
      }
      if (err && !res.headersSent) {
        return next(err)
      }
    })
  } catch (error) {
    console.error('[ARCHIVOS] Error en compresión ZIP:', error)
    return next(error)
  }
}
