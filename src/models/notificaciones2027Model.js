// Modelo de Notificaciones y Mensajes Predeterminados 2027
import { getNewPool, getPool, sql } from '../config/db.js'

// Mensajes predeterminados base iniciales
export const MENSAJES_PREDETERMINADOS_BASE = [
  {
    id_mensaje_predeterminado: 1,
    codigo: 'SOL_LIBERACION_EXTEMPORANEA',
    titulo: 'Solicitud de liberación extemporánea de actividad',
    cuerpo_mensaje: 'Por medio de la presente, se solicita la liberación para captura extemporánea de la acción educativa programada debido a causas de fuerza mayor.',
    tipo_flujo: 'DISTRITO_A_ADMIN',
    categoria: 'Liberación',
    requiere_id_accion: 1,
    permite_comentario_adicional: 1
  },
  {
    id_mensaje_predeterminado: 2,
    codigo: 'NOTIF_ACCION_FINALIZADA',
    titulo: 'Acción educativa concluida con evidencias completas',
    cuerpo_mensaje: 'Se hace de su conocimiento que la acción educativa ha sido debidamente capturada con sus formatos oficiales, fotografía y encuestas de satisfacción.',
    tipo_flujo: 'DISTRITO_A_ADMIN',
    categoria: 'Finalización',
    requiere_id_accion: 1,
    permite_comentario_adicional: 1
  },
  {
    id_mensaje_predeterminado: 3,
    codigo: 'AVISO_RECORDATORIO_CAPTURA',
    titulo: 'Recordatorio urgente de captura de actividad programada',
    cuerpo_mensaje: 'Estimado Distrito: Le recordamos que la acción educativa se encuentra en estado Sin Capturar y el plazo reglamentario está próximo a vencer.',
    tipo_flujo: 'ADMIN_A_DISTRITO',
    categoria: 'Aviso',
    requiere_id_accion: 1,
    permite_comentario_adicional: 1
  },
  {
    id_mensaje_predeterminado: 4,
    codigo: 'SOL_PRORROGA_GLOBAL',
    titulo: 'Solicitud de prórroga extraordinaria de sistema',
    cuerpo_mensaje: 'Se solicita al Superadministrador la autorización de una ampliación en la ventana de captura para atender incidencias distritales.',
    tipo_flujo: 'ADMIN_A_SUPERADMIN',
    categoria: 'Prórroga',
    requiere_id_accion: 0,
    permite_comentario_adicional: 1
  }
]

export const listMensajesPredeterminados = async (tipo_flujo) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'cat_mensajes_predeterminados'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    let query = `SELECT * FROM cat_mensajes_predeterminados WHERE status = 1`
    if (tipo_flujo) {
      request.input('flujo', sql.VarChar(30), tipo_flujo)
      query += ` AND tipo_flujo = @flujo`
    }
    query += ` ORDER BY id_mensaje_predeterminado ASC`
    const result = await request.query(query)
    return result.recordset
  }

  // Fallback a catálogo base
  if (tipo_flujo) {
    return MENSAJES_PREDETERMINADOS_BASE.filter(m => m.tipo_flujo === tipo_flujo)
  }
  return MENSAJES_PREDETERMINADOS_BASE
}

export const createMensajePredeterminado = async (payload) => {
  const pool = await getNewPool()
  const request = pool.request()
  request.input('codigo', sql.VarChar(40), payload.codigo)
  request.input('titulo', sql.VarChar(100), payload.titulo)
  request.input('cuerpo_mensaje', sql.VarChar(300), payload.cuerpo_mensaje)
  request.input('tipo_flujo', sql.VarChar(30), payload.tipo_flujo)
  request.input('categoria', sql.VarChar(50), payload.categoria || 'General')
  request.input('requiere_id_accion', sql.Bit, payload.requiere_id_accion ? 1 : 0)
  request.input('permite_comentario_adicional', sql.Bit, payload.permite_comentario_adicional ? 1 : 0)
  request.input('creado_por', sql.Int, payload.creado_por || null)

  const result = await request.query(`
    INSERT INTO cat_mensajes_predeterminados (
      codigo, titulo, cuerpo_mensaje, tipo_flujo, categoria,
      requiere_id_accion, permite_comentario_adicional, creado_por, status, fecha_alta
    )
    OUTPUT INSERTED.id_mensaje_predeterminado
    VALUES (
      @codigo, @titulo, @cuerpo_mensaje, @tipo_flujo, @categoria,
      @requiere_id_accion, @permite_comentario_adicional, @creado_por, 1, GETDATE()
    )
  `)

  return result.recordset[0]?.id_mensaje_predeterminado
}

export const enviarNotificacion2027 = async (payload) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'mensajes_notificaciones'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id_predeterminado', sql.Int, payload.id_mensaje_predeterminado || null)
    request.input('id_usuario_origen', sql.Int, payload.id_usuario_origen)
    request.input('id_distrito_origen', sql.Int, payload.id_distrito_origen || null)
    request.input('id_usuario_destino', sql.Int, payload.id_usuario_destino || null)
    request.input('id_tipousuario_destino', sql.Int, payload.id_tipousuario_destino || null)
    request.input('id_acciones_educativas', sql.Int, payload.id_acciones_educativas || null)
    request.input('titulo', sql.VarChar(120), payload.titulo)
    request.input('mensaje_base', sql.VarChar(300), payload.mensaje_base)
    request.input('comentario_adicional', sql.VarChar(100), String(payload.comentario_adicional || '').slice(0, 100))

    const result = await request.query(`
      INSERT INTO mensajes_notificaciones (
        id_mensaje_predeterminado, id_usuario_origen, id_distrito_origen,
        id_usuario_destino, id_tipousuario_destino, id_acciones_educativas,
        titulo, mensaje_base, comentario_adicional, estado_solicitud,
        leido, status, fecha_envio
      )
      OUTPUT INSERTED.id_mensaje
      VALUES (
        @id_predeterminado, @id_usuario_origen, @id_distrito_origen,
        @id_usuario_destino, @id_tipousuario_destino, @id_acciones_educativas,
        @titulo, @mensaje_base, @comentario_adicional, 'PENDIENTE',
        0, 1, GETDATE()
      )
    `)

    return result.recordset[0]?.id_mensaje
  }

  return Date.now()
}

export const listNotificaciones2027 = async (filtros = {}) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'mensajes_notificaciones'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    let query = `
      SELECT 
        mn.*,
        u_orig.usuario AS usuario_origen,
        u_orig.nombre_completo AS nombre_origen,
        ae.folio_accion_educativa,
        ae.nombre_institucion
      FROM mensajes_notificaciones mn
      INNER JOIN usuarios u_orig ON mn.id_usuario_origen = u_orig.id_usuario
      LEFT JOIN acciones_educativas ae ON mn.id_acciones_educativas = ae.id_acciones_educativas
      WHERE mn.status = 1
    `

    if (filtros.id_distrito) {
      request.input('distrito', sql.Int, filtros.id_distrito)
      query += ` AND mn.id_distrito_origen = @distrito`
    }
    if (filtros.id_tipousuario) {
      request.input('tipousuario', sql.Int, filtros.id_tipousuario)
      query += ` AND (mn.id_tipousuario_destino = @tipousuario OR mn.id_tipousuario_destino IS NULL)`
    }
    if (filtros.estado) {
      request.input('estado', sql.VarChar(20), filtros.estado)
      query += ` AND mn.estado_solicitud = @estado`
    }

    query += ` ORDER BY mn.fecha_envio DESC`
    const result = await request.query(query)
    return result.recordset
  }

  return []
}

export const atenderNotificacion2027 = async (id_mensaje, estado_solicitud, respuesta_admin, id_admin) => {
  const pool = await getNewPool()
  const request = pool.request()
  request.input('id', sql.Int, id_mensaje)
  request.input('estado', sql.VarChar(20), estado_solicitud)
  request.input('respuesta', sql.VarChar(250), String(respuesta_admin || '').slice(0, 250))
  request.input('atendido_por', sql.Int, id_admin)

  await request.query(`
    UPDATE mensajes_notificaciones
    SET 
      estado_solicitud = @estado,
      respuesta_admin = @respuesta,
      atendido_por = @atendido_por,
      fecha_atencion = GETDATE(),
      leido = 1,
      fecha_lectura = COALESCE(fecha_lectura, GETDATE())
    WHERE id_mensaje = @id
  `)
}
