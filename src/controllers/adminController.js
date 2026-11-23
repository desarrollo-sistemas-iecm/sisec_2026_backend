import { getConfigFechas, updateConfigFechas, deleteConfigFechasById } from '../models/configFechasModel.js'
import { crearNotificacion } from '../models/notificacionModel.js'
import { getNewPool, getPool, sql } from '../config/db.js'

export const listConfigFechas = async (req, res, next) => {
  try {
    const allData = await getConfigFechas()
    const data = allData.filter(d => d.modulo !== 'manual' && d.modulo !== 'alerta_login' && d.modulo !== 'ultima_actualizacion')

    const userPermiso = Number(req.user.permiso || req.user.idpermiso)
    const userSede = Number(req.user.idsede)

    if (userPermiso === 1) {
      // Filtrar para obtener solo la aplicable al operador
      const filtered = []
      const modulos = ['programacion', 'captura']
      for (const mod of modulos) {
        const configsMod = data.filter(d => d.modulo === mod)
        const specific = configsMod.find(d => d.idsede === userSede)
        const global = configsMod.find(d => d.idsede === 0)
        if (specific) filtered.push(specific)
        if (global) filtered.push(global)
      }
      return res.json({ success: true, data: filtered })
    }

    return res.json({ success: true, data })
  } catch (error) {
    return next(error)
  }
}

export const saveConfigFechas = async (req, res, next) => {
  try {
    const { modulo, fecha_inicio, fecha_fin, fecha_limite, habilitado, idsede = 0 } = req.body
    
    // Si se especifica un módulo en particular o ambos
    if (modulo === 'programacion') {
      await updateConfigFechas('programacion', fecha_inicio, fecha_fin, habilitado, idsede, req.user.idusuario, fecha_limite)
    } else if (modulo === 'captura') {
      await updateConfigFechas('captura', fecha_inicio, fecha_fin, habilitado, idsede, req.user.idusuario, fecha_limite)
    } else {
      // 'ambos' o global por defecto
      await updateConfigFechas('programacion', fecha_inicio, fecha_fin, habilitado, idsede, req.user.idusuario, fecha_limite)
      await updateConfigFechas('captura', fecha_inicio, fecha_fin, habilitado, idsede, req.user.idusuario, fecha_limite)
    }
    
    // Notificamos: Si idsede es 0, es a todos. Si no, a la sede específica.
    const vigenciaTexto = fecha_limite ? ` (Disponible hasta el ${fecha_limite})` : ''
    await crearNotificacion({
      tipo: 'fecha_habilitada',
      titulo: Number(idsede) === 0 ? 'Nuevo periodo de captura/programación habilitado' : `Fechas habilitadas (Distrito ${idsede})`,
      mensaje: `Se ha habilitado el periodo del ${fecha_inicio} al ${fecha_fin}${vigenciaTexto}.`,
      idsede_origen: 0,
      idsede_destino: Number(idsede),
      idusuario_destino: 0
    })

    return res.json({ success: true, message: 'Configuración actualizada con éxito' })
  } catch (error) {
    return next(error)
  }
}

export const deleteConfigFecha = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    await deleteConfigFechasById(id)
    return res.json({ success: true, message: 'Excepción de distrito eliminada' })
  } catch (error) {
    return next(error)
  }
}

export const requestFechaExcepcion = async (req, res, next) => {
  try {
    const { fecha_solicitada, modulo } = req.body
    
    await crearNotificacion({
      tipo: 'solicitud_fecha',
      titulo: `Solicitud de habilitación de fecha: Dtto ${req.user.idsede}`,
      mensaje: `El Distrito ${req.user.idsede} solicita habilitar la fecha ${fecha_solicitada} en el módulo de ${modulo}.`,
      idsede_origen: req.user.idsede,
      idsede_destino: 0, // SuperAdmins
      idusuario_destino: 0
    })

    return res.json({ success: true, message: 'Solicitud enviada al Super Administrador' })
  } catch (error) {
    return next(error)
  }
}

export const getManualConfig = async (req, res, next) => {
  try {
    return res.json({ success: true, habilitado: true })
  } catch (error) {
    return next(error)
  }
}

export const saveManualConfig = async (req, res, next) => {
  try {
    return res.json({ success: true, message: 'Configuración del manual actualizada' })
  } catch (error) {
    return next(error)
  }
}

export const getAlertaLoginConfig = async (req, res, next) => {
  try {
    return res.json({ 
      success: true, 
      habilitado: true,
      fecha_fin: '2027-12-31'
    })
  } catch (error) {
    return next(error)
  }
}

export const saveAlertaLoginConfig = async (req, res, next) => {
  try {
    return res.json({ success: true, message: 'Configuración de alerta de login actualizada' })
  } catch (error) {
    return next(error)
  }
}

export const getUltimaActualizacionConfig = async (req, res, next) => {
  try {
    const hoy = new Date().toISOString().split('T')[0]
    return res.json({ 
      success: true, 
      habilitado: true,
      fecha: hoy
    })
  } catch (error) {
    return next(error)
  }
}

export const saveUltimaActualizacionConfig = async (req, res, next) => {
  try {
    return res.json({ success: true, message: 'Configuración de última actualización guardada' })
  } catch (error) {
    return next(error)
  }
}

export const listCursosAdmin = async (req, res, next) => {
  try {
    const pool = await getNewPool()
    const result = await pool.request().query(`
      SELECT 
        ca.id_accion,
        ca.clave_accion,
        ca.nombre_accion,
        ca.color,
        ca.status,
        cv.vertiente,
        cv.id_vertiente
      FROM cat_acciones ca
      LEFT JOIN cat_vertientes cv ON ca.id_vertiente = cv.id_vertiente
      ORDER BY ca.id_accion ASC
    `)
    return res.json({ success: true, data: result.recordset })
  } catch (error) {
    return next(error)
  }
}

export const updateCursoColor = async (req, res, next) => {
  try {
    const id_accion = Number(req.params.id)
    const { color } = req.body
    const pool = await getNewPool()
    const checkTable = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'cat_acciones'
    `)
    if (checkTable.recordset.length > 0) {
      const request = pool.request()
      request.input('color', sql.VarChar(7), color || '#6B2D8B')
      request.input('id', sql.Int, id_accion)
      await request.query(`
        UPDATE cat_acciones
        SET color = @color, fecha_modif = GETDATE()
        WHERE id_accion = @id
      `)
    }

    // Actualizar también en memoria base
    const baseAction = ACCIONES_EDUCATIVAS_BASE.find(a => a.id === id_accion)
    if (baseAction) {
      baseAction.color = color
    }

    // Compatibilidad con histórico si existe la tabla
    try {
      const histPool = await getPool()
      await histPool.request()
        .input('color', sql.VarChar(7), color || null)
        .input('idcurso', sql.Int, id_accion)
        .query(`UPDATE sisecycc2024.dbo.sisec_cat_cursos SET color = @color WHERE idcurso = @idcurso`)
    } catch (e) {
      // ignore
    }

    return res.json({ success: true, message: 'Color identificador de la acción educativa actualizado con éxito' })
  } catch (error) {
    return next(error)
  }
}



