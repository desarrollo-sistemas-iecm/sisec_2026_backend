// Auth model for SISEC CC 2027
import bcrypt from 'bcryptjs'
import { getNewPool, sql } from '../config/db.js'

const isBcryptHash = (value = '') => value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$')

export const verifyCredentials = async (usuario, contrasena) => {
  const userInput = String(usuario ?? '').trim()
  const passInput = String(contrasena ?? '').trim()

  try {
    const newPool = await getNewPool()
    const newReq = newPool.request()
    newReq.input('usuario', sql.VarChar(50), userInput)
    const newResult = await newReq.query(`
      SELECT id_usuario, usuario, password, status, id_tipousuario, id_distrito
      FROM usuarios
      WHERE usuario = @usuario AND status = 1
    `)

    const userRow = newResult.recordset[0]
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
    return null
  } catch (err) {
    return null
  }
}

