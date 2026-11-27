// Auth model for SISEC CC 2026 / 2027
import bcrypt from 'bcryptjs'
import { getNewPool, getPool, sql } from '../config/db.js'

const isBcryptHash = (value = '') => value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$')

export const verifyCredentials = async (usuario, contrasena) => {
  const userInput = String(usuario ?? '').trim()
  const passInput = String(contrasena ?? '').trim()

  // 1. Intentar en base de datos 2027 (tabla usuarios)
  try {
    const newPool = await getNewPool()
    const newReq = newPool.request()
    newReq.input('usuario', sql.VarChar(50), userInput)
    const newResult = await newReq.query(`
      SELECT id_usuario, usuario, password, status, id_tipousuario, id_distrito
      FROM usuarios
      WHERE usuario = @usuario
    `)

    const userRow = newResult.recordset[0]
    if (userRow) {
      if (userRow.status === false || Number(userRow.status) === 0) {
        const inactiveErr = new Error('Tu cuenta ha sido desactivada temporalmente por la Dirección de Educación Cívica. Contacta al Administrador.')
        inactiveErr.code = 'CUENTA_DESACTIVADA'
        throw inactiveErr
      }

      const stored = String(userRow.password ?? '').trim()
      let valid = false
      if (isBcryptHash(stored)) {
        valid = await bcrypt.compare(passInput, stored)
      } else {
        valid = passInput === stored
      }

      if (valid) {
        return {
          idUsuario: userRow.id_usuario,
          id_usuario: userRow.id_usuario,
          idsede: userRow.id_distrito,
          id_distrito: userRow.id_distrito,
          permiso: userRow.id_tipousuario,
          id_tipousuario: userRow.id_tipousuario,
          nombre: userRow.usuario
        }
      }
    }
  } catch (err) {
    if (err.code === 'CUENTA_DESACTIVADA') throw err
    // Continuar a fallback
  }

  // 2. Fallback en base de datos activa (tabla sisec_usuarios)
  try {
    const pool = await getPool()
    const req = pool.request()
    req.input('usuario', sql.VarChar(50), userInput)
    const result = await req.query(`
      SELECT idusuario, usuario, password, estado, idpermiso, idsede
      FROM sisec_usuarios
      WHERE usuario = @usuario AND estado = 1
    `)

    const userRow = result.recordset[0]
    if (userRow) {
      const stored = String(userRow.password ?? '').trim()
      let valid = false
      if (isBcryptHash(stored)) {
        valid = await bcrypt.compare(passInput, stored)
      } else {
        valid = passInput === stored
      }

      if (valid) {
        return {
          idUsuario: userRow.idusuario,
          id_usuario: userRow.idusuario,
          idsede: userRow.idsede,
          id_distrito: userRow.idsede,
          permiso: userRow.idpermiso,
          id_tipousuario: userRow.idpermiso,
          nombre: userRow.usuario
        }
      }
    }
  } catch (errFallback) {
    // ignore
  }

  return null
}
