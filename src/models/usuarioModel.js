// Usuario model for SISEC CC 2027
import { getNewPool, getPool, sql } from '../config/db.js'

export const listUsuarios = async () => {
  try {
    // 1. Prioridad: BD Activa 2027 (tabla usuarios)
    const newPool = await getNewPool()
    const res = await newPool.request().query(`
      SELECT 
        id_usuario AS idusuario,
        id_usuario,
        usuario,
        CASE 
          WHEN id_tipousuario >= 2 OR usuario = 'admin' OR id_distrito = 0 OR id_distrito IS NULL THEN 0 
          ELSE id_distrito 
        END AS idsede,
        CASE 
          WHEN id_tipousuario >= 2 OR usuario = 'admin' OR id_distrito = 0 OR id_distrito IS NULL THEN 0 
          ELSE id_distrito 
        END AS id_distrito,
        id_tipousuario AS idpermiso,
        id_tipousuario,
        nombre_completo,
        correo,
        status AS estado,
        CONVERT(varchar(19), fecha_alta, 120) AS fecha_registro
      FROM usuarios
      WHERE status = 1
      ORDER BY id_distrito ASC, id_tipousuario ASC
    `)
    return res.recordset
  } catch (err) {
    // 2. Fallback a tabla sisec_usuarios si existiera en BD legacy
    try {
      const pool = await getPool()
      const result = await pool.request().query(`
        SELECT 
          idusuario,
          idusuario AS id_usuario,
          usuario,
          CASE 
            WHEN idpermiso >= 2 OR usuario = 'admin' OR idsede = 0 THEN 0 
            ELSE idsede 
          END AS idsede,
          CASE 
            WHEN idpermiso >= 2 OR usuario = 'admin' OR idsede = 0 THEN 0 
            ELSE idsede 
          END AS id_distrito,
          idpermiso,
          idpermiso AS id_tipousuario,
          estado,
          'N/A' as fecha_registro
        FROM sisec_usuarios
        WHERE estado = 1
        ORDER BY idsede ASC, idpermiso ASC
      `)
      return result.recordset
    } catch (e2) {
      console.error('[USUARIO_MODEL] Error al listar usuarios:', e2.message)
      return []
    }
  }
}

export const createUsuario = async (payload) => {
  const pool = await getNewPool()

  const cleanUsuario = String(payload.usuario ?? '').trim()
  const cleanPassword = String(payload.password ?? '').trim()

  if (!cleanUsuario || !cleanPassword) {
    throw new Error('El usuario y la contraseña son requeridos.')
  }

  const idPermiso = parseInt(payload.idpermiso || payload.id_tipousuario || 1, 10)
  let idSede = parseInt(payload.idsede !== undefined ? payload.idsede : (payload.id_distrito !== undefined ? payload.id_distrito : 1), 10)
  if (idPermiso >= 2 || cleanUsuario.toLowerCase() === 'admin') {
    idSede = 0
  }

  // 1. Validar si el usuario ya existe activo en la tabla `usuarios`
  const checkReq = pool.request()
  checkReq.input('usuario', sql.VarChar(50), cleanUsuario)
  const existResult = await checkReq.query(`
    SELECT id_usuario FROM usuarios WHERE LOWER(usuario) = LOWER(@usuario) AND status = 1
  `)
  if (existResult.recordset.length > 0) {
    throw new Error('El nombre de usuario ya existe.')
  }

  const nombreCompleto = payload.nombre_completo || (idPermiso === 1 ? `Operador Distrito ${String(idSede).padStart(2, '0')}` : cleanUsuario)
  const correo = payload.correo || `${cleanUsuario.toLowerCase()}@iecm.mx`

  // 2. Insertar en tabla usuarios (id_usuario es IDENTITY)
  const insertReq = pool.request()
  insertReq.input('usuario', sql.VarChar(50), cleanUsuario)
  insertReq.input('password', sql.VarChar(255), cleanPassword)
  insertReq.input('nombre_completo', sql.VarChar(120), nombreCompleto)
  insertReq.input('correo', sql.VarChar(100), correo)
  insertReq.input('id_tipousuario', sql.Int, idPermiso)
  insertReq.input('id_distrito', sql.Int, idSede === 0 ? null : idSede)

  const insertResult = await insertReq.query(`
    INSERT INTO usuarios (usuario, password, nombre_completo, correo, id_tipousuario, id_distrito, status, fecha_alta)
    OUTPUT INSERTED.id_usuario
    VALUES (@usuario, @password, @nombre_completo, @correo, @id_tipousuario, @id_distrito, 1, GETDATE())
  `)

  const newId = insertResult.recordset[0].id_usuario

  // 3. Asignar permisos modulares por defecto en rel_usuario_permisos
  try {
    const modulos = idPermiso === 1 ? [2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]
    for (const modId of modulos) {
      await pool.request()
        .input('id_usuario', sql.Int, newId)
        .input('id_modulo', sql.Int, modId)
        .input('id_accion_sistema', sql.Int, 1)
        .input('asignado_por', sql.Int, payload.asignado_por || 1)
        .query(`
          INSERT INTO rel_usuario_permisos (id_usuario, id_modulo, id_submodulo, id_accion_sistema, permitido, fecha_asignacion, asignado_por)
          VALUES (@id_usuario, @id_modulo, NULL, @id_accion_sistema, 1, GETDATE(), @asignado_por)
        `)
    }
  } catch (permErr) {
    console.warn('[USUARIO_MODEL] Aviso al asignar permisos modulares por defecto:', permErr.message)
  }

  return { idusuario: newId, id_usuario: newId }
}

export const updateUsuario = async (id, payload) => {
  const pool = await getNewPool()
  const request = pool.request()

  const idPermiso = parseInt(payload.idpermiso || payload.id_tipousuario || 1, 10)
  let idSede = parseInt(payload.idsede !== undefined ? payload.idsede : (payload.id_distrito !== undefined ? payload.id_distrito : 1), 10)
  if (idPermiso >= 2) {
    idSede = 0
  }

  request.input('id', sql.Int, id)
  request.input('id_distrito', sql.Int, idSede === 0 ? null : idSede)
  request.input('id_tipousuario', sql.Int, idPermiso)

  let query = `
    UPDATE usuarios
    SET id_distrito = @id_distrito, id_tipousuario = @id_tipousuario, fecha_modif = GETDATE()
  `

  if (payload.password) {
    const cleanPassword = String(payload.password ?? '').trim()
    request.input('password', sql.VarChar(255), cleanPassword)
    query += `, password = @password`
  }

  if (payload.nombre_completo) {
    request.input('nombre_completo', sql.VarChar(120), String(payload.nombre_completo).trim())
    query += `, nombre_completo = @nombre_completo`
  }

  if (payload.correo) {
    request.input('correo', sql.VarChar(100), String(payload.correo).trim())
    query += `, correo = @correo`
  }

  query += ` WHERE id_usuario = @id`
  await request.query(query)
}

export const deleteUsuario = async (id) => {
  const pool = await getNewPool()
  const request = pool.request()
  
  request.input('id', sql.Int, id)
  // Soft delete en tabla usuarios
  await request.query(`
    UPDATE usuarios 
    SET status = 0, fecha_baja = GETDATE() 
    WHERE id_usuario = @id
  `)
}
