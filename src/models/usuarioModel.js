// Usuario model for SISEC CC
import { getPool, getNewPool, sql } from '../config/db.js'

export const listUsuarios = async () => {
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
  } catch (err) {
    // Fallback a tabla usuarios de nueva BD si existiera
    try {
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
          status AS estado,
          CONVERT(varchar(19), fecha_alta, 120) AS fecha_registro
        FROM usuarios
        WHERE status = 1
        ORDER BY id_distrito ASC, id_tipousuario ASC
      `)
      return res.recordset
    } catch (e2) {
      console.error('[USUARIO_MODEL] Error al listar usuarios:', e2.message)
      return []
    }
  }
}

export const createUsuario = async (payload) => {
  const pool = await getPool()
  const request = pool.request()

  // Limitar a 10 caracteres para cumplir con la restricción VARCHAR(10) de la BD
  const cleanUsuario = String(payload.usuario ?? '').trim().substring(0, 10)
  const cleanPassword = String(payload.password ?? '').trim().substring(0, 10)

  request.input('usuario', sql.VarChar(10), cleanUsuario)
  
  // Validar si el usuario ya existe
  const existResult = await request.query(`
    SELECT idusuario FROM sisec_usuarios WHERE usuario = @usuario
  `)
  if (existResult.recordset.length > 0) {
    throw new Error('El nombre de usuario ya existe.')
  }

  // Obtener el siguiente idusuario disponible (al no ser columna IDENTITY)
  const maxResult = await pool.request().query(`
    SELECT ISNULL(MAX(idusuario), 0) + 1 AS nextId FROM sisec_usuarios
  `)
  const nextId = maxResult.recordset[0].nextId

  const idPermiso = parseInt(payload.idpermiso || payload.id_tipousuario || 1, 10)
  let idSede = parseInt(payload.idsede !== undefined ? payload.idsede : (payload.id_distrito !== undefined ? payload.id_distrito : 1), 10)
  if (idPermiso >= 2 || cleanUsuario.toLowerCase() === 'admin') {
    idSede = 0
  }

  request.input('idusuario', sql.TinyInt, nextId)
  request.input('password', sql.VarChar(10), cleanPassword)
  request.input('idsede', sql.TinyInt, idSede)
  request.input('idpermiso', sql.TinyInt, idPermiso)

  await request.query(`
    INSERT INTO sisec_usuarios (idusuario, usuario, password, pass2, idsede, idpermiso, estado)
    VALUES (@idusuario, @usuario, @password, @password, @idsede, @idpermiso, 1)
  `)
  return { idusuario: nextId, id_usuario: nextId }
}

export const updateUsuario = async (id, payload) => {
  const pool = await getPool()
  const request = pool.request()

  const idPermiso = parseInt(payload.idpermiso || payload.id_tipousuario || 1, 10)
  let idSede = parseInt(payload.idsede !== undefined ? payload.idsede : (payload.id_distrito !== undefined ? payload.id_distrito : 1), 10)
  if (idPermiso >= 2) {
    idSede = 0
  }

  request.input('id', sql.Int, id)
  request.input('idsede', sql.TinyInt, idSede)
  request.input('idpermiso', sql.TinyInt, idPermiso)

  let query = `
    UPDATE sisec_usuarios
    SET idsede = @idsede, idpermiso = @idpermiso
  `

  if (payload.password) {
    const cleanPassword = String(payload.password ?? '').trim().substring(0, 10)
    request.input('password', sql.VarChar(10), cleanPassword)
    query += `, password = @password, pass2 = @password`
  }

  query += ` WHERE idusuario = @id`
  await request.query(query)
}

export const deleteUsuario = async (id) => {
  const pool = await getPool()
  const request = pool.request()
  
  request.input('id', sql.Int, id)
  // Soft delete
  await request.query(`
    UPDATE sisec_usuarios SET estado = 0 WHERE idusuario = @id
  `)
}
