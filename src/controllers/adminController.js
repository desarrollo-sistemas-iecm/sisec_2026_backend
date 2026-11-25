import { getConfigFechas, updateConfigFechas, deleteConfigFechasById } from '../models/configFechasModel.js'
import { crearNotificacion } from '../models/notificacionModel.js'
import { getNewPool, getPool, sql } from '../config/db.js'
import { getIo } from '../socket.js'

export const listConfigFechas = async (req, res, next) => {
  try {
    const allData = await getConfigFechas()
    const data = allData.filter(d => d.modulo !== 'manual' && d.modulo !== 'alerta_login' && d.modulo !== 'ultima_actualizacion' && d.modulo !== 'ultima_act')

    const userPermiso = Number(req.user.permiso || req.user.idpermiso)
    const userSede = Number(req.user.idsede ?? req.user.id_distrito ?? 0)

    if (userPermiso === 1) {
      // Filtrar para obtener solo la aplicable al operador
      const filtered = []
      const modulos = ['programacion', 'captura', 'ambos']
      for (const mod of modulos) {
        const configsMod = data.filter(d => d.modulo === mod || d.modulo === 'ambos')
        const specific = configsMod.find(d => Number(d.idsede) === userSede)
        const global = configsMod.find(d => Number(d.idsede) === 0)
        if (specific && !filtered.some(f => f.id === specific.id)) filtered.push(specific)
        if (global && !filtered.some(f => f.id === global.id)) filtered.push(global)
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

    // Emitir socket en vivo para actualización inmediata de radiales
    try {
      const io = getIo()
      if (io) {
        io.emit('fechas:actualizadas', {
          idsede: Number(idsede),
          modulo,
          fecha_inicio,
          fecha_fin,
          fecha_limite
        })
      }
    } catch (wsErr) {
      // ignore
    }

    return res.json({ success: true, message: 'Configuración actualizada con éxito' })
  } catch (error) {
    return next(error)
  }
}

export const deleteConfigFecha = async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    await deleteConfigFechasById(id)
    try {
      const io = getIo()
      if (io) {
        io.emit('fechas:actualizadas', { id, deleted: true })
      }
    } catch (wsErr) {}
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
    const pool = await getNewPool()
    const result = await pool.request().query("SELECT TOP 1 status FROM config_fechas_acceso WHERE tipo_alcance = 'manual'")
    const habilitado = result.recordset.length > 0 ? Boolean(result.recordset[0].status) : false
    return res.json({ success: true, habilitado })
  } catch (error) {
    return next(error)
  }
}

export const saveManualConfig = async (req, res, next) => {
  try {
    const { habilitado } = req.body
    const pool = await getNewPool()
    const request = pool.request()
    request.input('tipo_alcance', sql.VarChar(20), 'manual')
    request.input('status', sql.Bit, habilitado ? 1 : 0)
    request.input('descripcion', sql.VarChar(120), 'Visibilidad del Manual de Usuario')

    await request.query(`
      IF EXISTS (SELECT 1 FROM config_fechas_acceso WHERE tipo_alcance = @tipo_alcance)
        UPDATE config_fechas_acceso 
        SET status = @status, fecha_modif = GETDATE() 
        WHERE tipo_alcance = @tipo_alcance
      ELSE
        INSERT INTO config_fechas_acceso (
          descripcion, tipo_alcance, id_distrito, fecha_hora_apertura, fecha_hora_cierre, permite_superadmin, status, fecha_alta
        ) VALUES (
          @descripcion, @tipo_alcance, NULL, GETDATE(), '2026-12-31 23:59:59', 1, @status, GETDATE()
        )
    `)

    // Notificar en vivo a todos los clientes por Socket.IO
    try {
      const io = getIo()
      io.emit('config:manual', { habilitado: Boolean(habilitado) })
    } catch (wsErr) {
      console.warn('[WS] Error al emitir config:manual:', wsErr.message)
    }

    return res.json({ success: true, message: 'Configuración del manual actualizada', habilitado: Boolean(habilitado) })
  } catch (error) {
    return next(error)
  }
}

export const getAlertaLoginConfig = async (req, res, next) => {
  try {
    const pool = await getNewPool()
    const result = await pool.request().query("SELECT TOP 1 status, format(fecha_hora_cierre, 'yyyy-MM-dd') as fecha_fin FROM config_fechas_acceso WHERE tipo_alcance = 'alerta_login'")
    const habilitado = result.recordset.length > 0 ? Boolean(result.recordset[0].status) : false
    const fecha_fin = result.recordset.length > 0 && result.recordset[0].fecha_fin ? result.recordset[0].fecha_fin : '2026-12-31'
    return res.json({ 
      success: true, 
      habilitado,
      fecha_fin
    })
  } catch (error) {
    return next(error)
  }
}

export const saveAlertaLoginConfig = async (req, res, next) => {
  try {
    const { habilitado, fecha_fin = '2026-12-31' } = req.body
    const pool = await getNewPool()
    const request = pool.request()
    request.input('tipo_alcance', sql.VarChar(20), 'alerta_login')
    request.input('status', sql.Bit, habilitado ? 1 : 0)
    request.input('descripcion', sql.VarChar(120), 'Alerta de manual al iniciar sesión')
    request.input('fecha_cierre', sql.DateTime, `${fecha_fin} 23:59:59`)

    await request.query(`
      IF EXISTS (SELECT 1 FROM config_fechas_acceso WHERE tipo_alcance = @tipo_alcance)
        UPDATE config_fechas_acceso 
        SET status = @status, fecha_hora_cierre = @fecha_cierre, fecha_modif = GETDATE() 
        WHERE tipo_alcance = @tipo_alcance
      ELSE
        INSERT INTO config_fechas_acceso (
          descripcion, tipo_alcance, id_distrito, fecha_hora_apertura, fecha_hora_cierre, permite_superadmin, status, fecha_alta
        ) VALUES (
          @descripcion, @tipo_alcance, NULL, GETDATE(), @fecha_cierre, 1, @status, GETDATE()
        )
    `)

    // Notificar en vivo a todos los clientes por Socket.IO
    try {
      const io = getIo()
      io.emit('config:alerta_login', { habilitado: Boolean(habilitado) })
    } catch (wsErr) {
      console.warn('[WS] Error al emitir config:alerta_login:', wsErr.message)
    }

    return res.json({ success: true, message: 'Configuración de alerta de login actualizada', habilitado: Boolean(habilitado) })
  } catch (error) {
    return next(error)
  }
}

export const getUltimaActualizacionConfig = async (req, res, next) => {
  try {
    const pool = await getNewPool()
    const result = await pool.request().query("SELECT TOP 1 status, mensaje_bloqueo, format(fecha_hora_cierre, 'yyyy-MM-dd') as fecha FROM config_fechas_acceso WHERE tipo_alcance = 'ultima_act'")
    
    let habilitado = false
    let fecha = new Date().toISOString().split('T')[0]

    if (result.recordset.length > 0) {
      habilitado = Boolean(result.recordset[0].status)
      if (result.recordset[0].mensaje_bloqueo) {
        fecha = result.recordset[0].mensaje_bloqueo
      } else if (result.recordset[0].fecha) {
        fecha = result.recordset[0].fecha
      }
    }

    return res.json({ 
      success: true, 
      habilitado,
      fecha
    })
  } catch (error) {
    return next(error)
  }
}

export const saveUltimaActualizacionConfig = async (req, res, next) => {
  try {
    const { habilitado, fecha } = req.body
    const hoy = fecha || new Date().toISOString().split('T')[0]

    const pool = await getNewPool()
    const request = pool.request()
    request.input('tipo_alcance', sql.VarChar(20), 'ultima_act')
    request.input('status', sql.Bit, habilitado ? 1 : 0)
    request.input('descripcion', sql.VarChar(120), 'Etiqueta de Última Actualización de Código')
    request.input('fecha_cierre', sql.DateTime, `${hoy} 23:59:59`)
    request.input('mensaje_bloqueo', sql.VarChar(255), hoy)

    await request.query(`
      IF EXISTS (SELECT 1 FROM config_fechas_acceso WHERE tipo_alcance = @tipo_alcance)
        UPDATE config_fechas_acceso 
        SET status = @status, fecha_hora_cierre = @fecha_cierre, mensaje_bloqueo = @mensaje_bloqueo, fecha_modif = GETDATE() 
        WHERE tipo_alcance = @tipo_alcance
      ELSE
        INSERT INTO config_fechas_acceso (
          descripcion, tipo_alcance, id_distrito, fecha_hora_apertura, fecha_hora_cierre, mensaje_bloqueo, permite_superadmin, status, fecha_alta
        ) VALUES (
          @descripcion, @tipo_alcance, NULL, GETDATE(), @fecha_cierre, @mensaje_bloqueo, 1, @status, GETDATE()
        )
    `)

    // Notificar en vivo a todos los clientes por Socket.IO
    try {
      const io = getIo()
      io.emit('config:ultima_actualizacion', { habilitado: Boolean(habilitado), fecha: hoy })
    } catch (wsErr) {
      console.warn('[WS] Error al emitir config:ultima_actualizacion:', wsErr.message)
    }

    return res.json({ 
      success: true, 
      message: 'Configuración de última actualización guardada',
      habilitado: Boolean(habilitado),
      fecha: hoy
    })
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
        cv.id_vertiente,
        cv.color AS color_vertiente
      FROM cat_acciones ca
      LEFT JOIN cat_vertientes cv ON ca.id_vertiente = cv.id_vertiente
      ORDER BY ca.id_accion ASC
    `)

    const vertientesRes = await pool.request().query(`
      SELECT id_vertiente, vertiente, color FROM cat_vertientes WHERE status = 1 ORDER BY id_vertiente ASC
    `)

    return res.json({ 
      success: true, 
      data: result.recordset,
      vertientes: vertientesRes.recordset 
    })
  } catch (error) {
    return next(error)
  }
}

export const updateVertienteColor = async (req, res, next) => {
  try {
    const id_vertiente = Number(req.params.id)
    const { color } = req.body
    if (!color) {
      return res.status(400).json({ success: false, message: 'El color es obligatorio.' })
    }

    const pool = await getNewPool()
    const request = pool.request()
    request.input('color', sql.VarChar(20), color.trim())
    request.input('id_vertiente', sql.Int, id_vertiente)
    await request.query(`
      UPDATE cat_vertientes
      SET color = @color
      WHERE id_vertiente = @id_vertiente;

      UPDATE cat_acciones
      SET color = @color, fecha_modif = GETDATE()
      WHERE id_vertiente = @id_vertiente;
    `)

    return res.json({ 
      success: true, 
      message: 'Color de vertiente institucional y de todas sus acciones educativas actualizado con éxito' 
    })
  } catch (error) {
    return next(error)
  }
}

export const createCursoAdmin = async (req, res, next) => {
  try {
    const { nombre_accion, id_vertiente, color } = req.body

    if (!nombre_accion || !nombre_accion.trim()) {
      return res.status(400).json({ success: false, message: 'El nombre de la acción educativa es obligatorio.' })
    }
    if (!id_vertiente) {
      return res.status(400).json({ success: false, message: 'La vertiente institucional es obligatoria.' })
    }

    const pool = await getNewPool()

    // 1. Obtener consecutivo seguro para la clave (ej. si la última es AE-31 -> AE-32)
    const resultClaves = await pool.request().query(`
      SELECT clave_accion FROM cat_acciones WHERE clave_accion LIKE 'AE-%'
    `)

    let maxNum = 0
    resultClaves.recordset.forEach(row => {
      const match = String(row.clave_accion || '').match(/^AE-(\d+)$/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    })

    const nextNum = maxNum + 1
    const nextClave = `AE-${String(nextNum).padStart(2, '0')}`
    const colorHex = (color && color.trim()) ? color.trim() : '#6B2D8B'

    // 2. Insertar en cat_acciones
    const insertReq = pool.request()
    insertReq.input('clave_accion', sql.VarChar(10), nextClave)
    insertReq.input('nombre_accion', sql.VarChar(200), nombre_accion.trim())
    insertReq.input('id_vertiente', sql.Int, Number(id_vertiente))
    insertReq.input('color', sql.VarChar(20), colorHex)

    const insertResult = await insertReq.query(`
      INSERT INTO cat_acciones (clave_accion, nombre_accion, id_vertiente, color, fecha_alta, status)
      OUTPUT INSERTED.id_accion, INSERTED.clave_accion, INSERTED.nombre_accion, INSERTED.id_vertiente, INSERTED.color, INSERTED.status
      VALUES (@clave_accion, @nombre_accion, @id_vertiente, @color, GETDATE(), 1)
    `)

    const newAccion = insertResult.recordset[0]

    const vertienteRes = await pool.request()
      .input('id_vertiente', sql.Int, Number(id_vertiente))
      .query(`SELECT vertiente FROM cat_vertientes WHERE id_vertiente = @id_vertiente`)

    newAccion.vertiente = vertienteRes.recordset[0]?.vertiente || 'General'

    return res.status(201).json({
      success: true,
      message: `Acción educativa ${nextClave} creada exitosamente.`,
      data: newAccion
    })
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
      request.input('color', sql.VarChar(20), color || '#6B2D8B')
      request.input('id', sql.Int, id_accion)
      await request.query(`
        UPDATE cat_acciones
        SET color = @color, fecha_modif = GETDATE()
        WHERE id_accion = @id
      `)
    }

    // Compatibilidad con histórico si existe la tabla
    try {
      const histPool = await getPool()
      await histPool.request()
        .input('color', sql.VarChar(20), color || null)
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



