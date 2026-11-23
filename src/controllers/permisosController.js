// Permisos Controller - SISEC CC 2027 RBAC
import { getNewPool, getPool, sql } from '../config/db.js'
import { logger } from '../config/logger.js'

/**
 * Obtener catálogos completos de módulos, submódulos y acciones
 */
export const getPermisosCatalogos = async (req, res, next) => {
  try {
    const pool = await getNewPool()
    const modulosRes = await pool.request().query(`
      SELECT id_modulo, codigo, nombre, icono, orden, status 
      FROM cat_modulos 
      WHERE status = 1 
      ORDER BY orden ASC
    `)

    const submodulosRes = await pool.request().query(`
      SELECT id_submodulo, id_modulo, codigo, nombre, ruta, status 
      FROM cat_submodulos 
      WHERE status = 1 
      ORDER BY id_submodulo ASC
    `)

    const accionesRes = await pool.request().query(`
      SELECT id_accion_sistema, codigo, nombre, status 
      FROM cat_acciones_sistema 
      WHERE status = 1 
      ORDER BY id_accion_sistema ASC
    `)

    return res.json({
      success: true,
      modulos: modulosRes.recordset,
      submodulos: submodulosRes.recordset,
      acciones: accionesRes.recordset
    })
  } catch (error) {
    logger.error(`[PERMISOS] Error al obtener catálogos: ${error.message}`)
    return next(error)
  }
}

/**
 * Obtener permisos granulares de un usuario específico
 */
export const getPermisosUsuario = async (req, res, next) => {
  try {
    const idUsuario = parseInt(req.params.id_usuario, 10)
    if (!idUsuario) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido' })
    }

    const pool = await getNewPool()
    const result = await pool.request()
      .input('id_usuario', sql.Int, idUsuario)
      .query(`
        SELECT id_permiso_usuario, id_usuario, id_modulo, id_submodulo, id_accion_sistema, permitido, fecha_asignacion, asignado_por
        FROM rel_usuario_permisos
        WHERE id_usuario = @id_usuario
      `)

    return res.json({
      success: true,
      id_usuario: idUsuario,
      permisos: result.recordset
    })
  } catch (error) {
    logger.error(`[PERMISOS] Error al consultar permisos de usuario: ${error.message}`)
    return next(error)
  }
}

/**
 * Guardar / Reemplazar permisos granulares para un usuario (Superadministrador)
 */
export const savePermisosUsuario = async (req, res, next) => {
  try {
    const idUsuario = parseInt(req.params.id_usuario, 10)
    const { permisos } = req.body // Array de { id_modulo, id_submodulo, id_accion_sistema, permitido }

    if (!idUsuario) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido' })
    }

    if (!Array.isArray(permisos)) {
      return res.status(400).json({ success: false, message: 'La lista de permisos debe ser un arreglo' })
    }

    const pool = await getNewPool()
    const asignadoPor = req.user?.idUsuario || 1

    // Ejecutar en bloque: limpiar permisos anteriores e insertar nuevos
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const deleteReq = new sql.Request(transaction)
      deleteReq.input('id_usuario', sql.Int, idUsuario)
      await deleteReq.query('DELETE FROM rel_usuario_permisos WHERE id_usuario = @id_usuario')

      for (const p of permisos) {
        if (!p.permitido) continue // Solo guardar los permitidos para optimizar espacio

        const insertReq = new sql.Request(transaction)
        insertReq.input('id_usuario', sql.Int, idUsuario)
        insertReq.input('id_modulo', sql.Int, p.id_modulo || null)
        insertReq.input('id_submodulo', sql.Int, p.id_submodulo || null)
        insertReq.input('id_accion_sistema', sql.Int, p.id_accion_sistema || null)
        insertReq.input('permitido', sql.Bit, p.permitido ? 1 : 0)
        insertReq.input('asignado_por', sql.Int, asignadoPor)

        await insertReq.query(`
          INSERT INTO rel_usuario_permisos 
            (id_usuario, id_modulo, id_submodulo, id_accion_sistema, permitido, fecha_asignacion, asignado_por)
          VALUES 
            (@id_usuario, @id_modulo, @id_submodulo, @id_accion_sistema, @permitido, GETDATE(), @asignado_por)
        `)
      }

      await transaction.commit()

      logger.info(`[PERMISOS] Permisos actualizados para usuario ${idUsuario} por admin ${asignadoPor}`)
      return res.json({
        success: true,
        message: 'Permisos actualizados correctamente'
      })
    } catch (txError) {
      await transaction.rollback()
      throw txError
    }
  } catch (error) {
    logger.error(`[PERMISOS] Error al guardar permisos: ${error.message}`)
    return next(error)
  }
}

/**
 * Obtener matriz de permisos activos del usuario autenticado
 */
export const getMisPermisos = async (req, res, next) => {
  try {
    const idUsuario = req.user?.idUsuario
    const idTipoUsuario = Number(req.user?.permiso || req.user?.idpermiso || 1)

    // Si es Superadmin (rol 3), tiene acceso total a todo
    if (idTipoUsuario === 3) {
      return res.json({
        success: true,
        isSuperAdmin: true,
        permisoNivel: 3,
        permisos: 'ALL'
      })
    }

    const pool = await getNewPool()
    const permisosRes = await pool.request()
      .input('id_usuario', sql.Int, idUsuario)
      .query(`
        SELECT 
          p.id_modulo, m.codigo AS codigo_modulo,
          p.id_submodulo, sm.codigo AS codigo_submodulo,
          p.id_accion_sistema, a.codigo AS codigo_accion,
          p.permitido
        FROM rel_usuario_permisos p
        LEFT JOIN cat_modulos m ON p.id_modulo = m.id_modulo
        LEFT JOIN cat_submodulos sm ON p.id_submodulo = sm.id_submodulo
        LEFT JOIN cat_acciones_sistema a ON p.id_accion_sistema = a.id_accion_sistema
        WHERE p.id_usuario = @id_usuario AND p.permitido = 1
      `)

    return res.json({
      success: true,
      isSuperAdmin: false,
      permisoNivel: idTipoUsuario,
      permisos: permisosRes.recordset
    })
  } catch (error) {
    logger.error(`[PERMISOS] Error al obtener mis permisos: ${error.message}`)
    return next(error)
  }
}
