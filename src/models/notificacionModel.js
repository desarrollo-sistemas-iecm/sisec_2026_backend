// Notificaciones model for SISEC CC 2027
import { getNewPool, sql } from '../config/db.js'

export const getNotificaciones = async (idsede, idusuario, idpermiso) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()

    request.input('idsede', sql.Int, Number(idsede) || 0)
    request.input('idusuario', sql.Int, Number(idusuario) || 0)
    request.input('idpermiso', sql.Int, Number(idpermiso) || 1)

    const result = await request.query(`
      SELECT TOP 50 
        id_mensaje AS id,
        estado_solicitud AS tipo,
        titulo,
        ISNULL(comentario_adicional, mensaje_base) AS mensaje,
        ISNULL(id_distrito_origen, 0) AS idsede_origen,
        ISNULL(id_distrito_origen, 0) AS idsede_destino,
        ISNULL(id_usuario_destino, 0) AS idusuario_destino,
        CASE WHEN leido = 1 THEN 1 ELSE 0 END AS leida,
        fecha_envio AS fecha_creacion
      FROM mensajes_notificaciones
      WHERE 
        (id_usuario_destino IS NULL OR id_usuario_destino = 0 OR id_usuario_destino = @idusuario)
        AND (@idpermiso >= 2 OR id_distrito_origen = @idsede OR id_usuario_destino = @idusuario)
      ORDER BY fecha_envio DESC
    `)

    return result.recordset
  } catch (error) {
    return []
  }
}

export const getSolicitudesPendientes = async () => {
  try {
    const pool = await getNewPool()
    const result = await pool.request().query(`
      SELECT 
        id_mensaje AS id,
        estado_solicitud AS tipo,
        titulo,
        ISNULL(comentario_adicional, mensaje_base) AS mensaje,
        ISNULL(id_distrito_origen, 0) AS idsede_origen,
        CASE WHEN leido = 1 THEN 1 ELSE 0 END AS leida,
        fecha_envio AS fecha_creacion
      FROM mensajes_notificaciones
      WHERE estado_solicitud = 'PENDIENTE' AND (leido = 0 OR leido IS NULL)
      ORDER BY fecha_envio ASC
    `)

    return result.recordset
  } catch (error) {
    return []
  }
}

export const marcarComoLeida = async (id, idsede, idusuario) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()
    request.input('id', sql.Int, id)
    await request.query(`
      UPDATE mensajes_notificaciones
      SET leido = 1, fecha_lectura = GETDATE()
      WHERE id_mensaje = @id
    `)
  } catch (error) {}
}

export const marcarTodasComoLeidas = async (idsede, idusuario) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()
    request.input('idusuario', sql.Int, Number(idusuario) || 0)
    await request.query(`
      UPDATE mensajes_notificaciones
      SET leido = 1, fecha_lectura = GETDATE()
      WHERE id_usuario_destino = @idusuario
    `)
  } catch (error) {}
}

export const crearNotificacion = async (payload) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()

    request.input('titulo', sql.VarChar(120), payload.titulo || 'Notificación')
    request.input('mensaje', sql.VarChar(500), payload.mensaje || '')
    request.input('idsede_origen', sql.Int, Number(payload.idsede_origen) || 0)
    request.input('idusuario_destino', sql.Int, Number(payload.idusuario_destino) || 0)

    await request.query(`
      INSERT INTO mensajes_notificaciones (
        id_distrito_origen, id_usuario_destino, titulo, mensaje_base, estado_solicitud, leido, status, fecha_envio
      ) VALUES (
        @idsede_origen, @idusuario_destino, @titulo, @mensaje, 'PENDIENTE', 0, 1, GETDATE()
      )
    `)
  } catch (error) {}
}
