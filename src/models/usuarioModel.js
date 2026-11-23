// Usuario model for SISEC CC 2027
import { getNewPool, getPool, sql } from '../config/db.js'

export const listUsuarios = async () => {
  try {
    const newPool = await getNewPool()
    const result = await newPool.request().query(`
      SELECT 
        u.id_usuario AS idusuario,
        u.id_usuario,
        u.usuario,
        ISNULL(u.nombre_completo, u.usuario) AS nombre_completo,
        ISNULL(u.correo, '') AS correo,
        ISNULL(u.id_distrito, 1) AS idsede,
        ISNULL(u.id_distrito, 1) AS id_distrito,
        d.distrito,
        u.id_tipousuario AS idpermiso,
        u.id_tipousuario,
        t.descripcion AS perfil,
        CASE WHEN u.status = 1 THEN 1 ELSE 0 END AS estado,
        u.session_id,
        u.fecha_alta,
        CONVERT(varchar(19), u.fecha_alta, 120) AS fecha_registro
      FROM usuarios u
      LEFT JOIN cat_tipousuarios t ON u.id_tipousuario = t.id_tipousuario
      LEFT JOIN cat_distritos d ON u.id_distrito = d.id_distrito
      WHERE u.status = 1
      ORDER BY u.id_distrito ASC, u.id_tipousuario ASC
    `)
    return result.recordset
  } catch (err) {
    return []
  }
}

export const createUsuario = async (payload) => {
  const cleanUsuario = String(payload.usuario ?? '').trim()
  const cleanPassword = String(payload.password ?? '').trim()
  const idSede = parseInt(payload.idsede || payload.id_distrito || 1, 10)
  const idPermiso = parseInt(payload.idpermiso || payload.id_tipousuario || 1, 10)
  const nombreCompleto = payload.nombre_completo || cleanUsuario
  const correo = payload.correo || null

  const newPool = await getNewPool()

  // Validar unicidad de usuario
  const checkReq = newPool.request()
  checkReq.input('usuario', sql.VarChar(50), cleanUsuario)
  const existRes = await checkReq.query('SELECT id_usuario FROM usuarios WHERE usuario = @usuario')
  if (existRes.recordset.length > 0) {
    throw new Error('El nombre de usuario ya existe.')
  }

  const insertReq = newPool.request()
  insertReq.input('usuario', sql.VarChar(50), cleanUsuario)
  insertReq.input('password', sql.VarChar(255), cleanPassword)
  insertReq.input('nombre_completo', sql.VarChar(120), nombreCompleto)
  insertReq.input('correo', sql.VarChar(100), correo)
  insertReq.input('id_tipousuario', sql.Int, idPermiso)
  insertReq.input('id_distrito', sql.Int, idSede)

  const insertRes = await insertReq.query(`
    INSERT INTO usuarios 
      (usuario, password, nombre_completo, correo, id_tipousuario, id_distrito, status, fecha_alta)
    VALUES 
      (@usuario, @password, @nombre_completo, @correo, @id_tipousuario, @id_distrito, 1, GETDATE());
    SELECT SCOPE_IDENTITY() AS newId;
  `)

  const newId = insertRes.recordset[0]?.newId

  return { idusuario: newId, id_usuario: newId }
}

export const updateUsuario = async (id, payload) => {
  const newPool = await getNewPool()
  const request = newPool.request()

  const idSede = parseInt(payload.idsede || payload.id_distrito || 1, 10)
  const idPermiso = parseInt(payload.idpermiso || payload.id_tipousuario || 1, 10)

  request.input('id', sql.Int, id)
  request.input('idsede', sql.Int, idSede)
  request.input('idpermiso', sql.Int, idPermiso)

  let query = `
    UPDATE usuarios
    SET id_distrito = @idsede, id_tipousuario = @idpermiso, fecha_modif = GETDATE()
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

  query += ` WHERE id_usuario = @id`
  await request.query(query)
}

export const deleteUsuario = async (id) => {
  const newPool = await getNewPool()
  const request = newPool.request()
  request.input('id', sql.Int, id)
  await request.query(`
    UPDATE usuarios SET status = 0, fecha_baja = GETDATE() WHERE id_usuario = @id
  `)
}
