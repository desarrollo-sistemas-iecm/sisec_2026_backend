import fs from 'fs/promises'
import path from 'path'
import { env } from '../config/env.js'
import { crearNotificacion } from '../models/notificacionModel.js'
import { getNewPool, getPool, sql } from '../config/db.js'

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

// Navegación de directorios
export const getArchivosTree = async (req, res, next) => {
  try {
    const { folder = '' } = req.query
    const baseDir = path.resolve(env.uploadPath)
    const targetDir = path.resolve(baseDir, folder)

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
        const stats = await fs.stat(path.join(targetDir, entry.name))
        size = stats.size
        modified = stats.mtime
      }

      items.push({
        name: entry.name,
        isDir,
        path: path.join(folder, entry.name).replace(/\\/g, '/'),
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
    const baseDir = path.resolve(env.uploadPath)
    const targetPath = path.resolve(baseDir, filepath)

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
      ruta_archivo: filepath,
      nombre_archivo: path.basename(filepath),
      motivo: motivo || 'Eliminación manual por reto de seguridad superado',
      ip_origen: ipOrigen
    })

    // Notificación en sistema
    await crearNotificacion({
      tipo: 'archivo_actualizado',
      titulo: 'Archivo eliminado por administrador',
      mensaje: `El archivo ${path.basename(filepath)} ha sido eliminado por el usuario ID ${idUsuario}.`,
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

    const baseDir = path.resolve(env.uploadPath)
    const targetPath = path.resolve(baseDir, filepath)

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
      mensaje: `El archivo ${path.basename(filepath)} ha sido actualizado en sistema.`,
      idsede_origen: 0,
      idsede_destino: 0,
      idusuario_destino: 0
    })

    return res.json({ success: true, message: 'Archivo reemplazado exitosamente' })
  } catch (error) {
    return next(error)
  }
}
