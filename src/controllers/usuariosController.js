import { listUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../models/usuarioModel.js'
import { usuariosConectados, desconectarUsuario } from '../socket.js'
import { getPool, sql } from '../config/db.js'

export const getUsuarios = async (req, res, next) => {
  try {
    const data = await listUsuarios()
    const currentUserId = Number(req.user?.idUsuario || req.user?.id_usuario || 0)
    const currentUsername = String(req.user?.usuario || req.user?.nombre || '').toLowerCase().trim()

    const enrichedData = data.map(u => {
      const uid = Number(u.idusuario || u.id_usuario || 0)
      const uname = String(u.usuario || '').toLowerCase().trim()

      const isCurrentOnline = 
        usuariosConectados.has(uid) ||
        Array.from(usuariosConectados.values()).some(v => String(v.username).toLowerCase() === uname) ||
        (currentUserId && uid === currentUserId) ||
        (currentUsername && uname === currentUsername)

      return {
        ...u,
        conectado: Boolean(isCurrentOnline)
      }
    })
    return res.json({ success: true, data: enrichedData })
  } catch (error) {
    return next(error)
  }
}

export const postUsuario = async (req, res, next) => {
  try {
    const data = await createUsuario(req.body)
    return res.json({ success: true, message: 'Usuario creado exitosamente', data })
  } catch (error) {
    if (error.message.includes('ya existe')) {
      return res.status(400).json({ success: false, message: error.message })
    }
    return next(error)
  }
}

export const putUsuario = async (req, res, next) => {
  try {
    const userPermiso = Number(req.user?.permiso || req.user?.idpermiso)
    if (userPermiso !== 3 && Number(req.body.idpermiso) === 3) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo un Super Administrador puede asignar el rol de Super Administrador.' })
    }
    await updateUsuario(Number(req.params.id), req.body)
    return res.json({ success: true, message: 'Usuario actualizado exitosamente' })
  } catch (error) {
    return next(error)
  }
}

export const delUsuario = async (req, res, next) => {
  try {
    await deleteUsuario(Number(req.params.id))
    return res.json({ success: true, message: 'Usuario eliminado exitosamente' })
  } catch (error) {
    return next(error)
  }
}

export const desconectarUsuarioEndpoint = async (req, res, next) => {
  try {
    const userPermiso = Number(req.user?.permiso || req.user?.idpermiso)
    if (userPermiso !== 3) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Únicamente el Super Administrador puede desconectar sesiones.' })
    }

    const idUsuario = Number(req.params.id)

    // 1. Invalidar en base de datos 2027
    try {
      const { getNewPool } = await import('../config/db.js')
      const newPool = await getNewPool()
      await newPool.request()
        .input('idusuario', sql.Int, idUsuario)
        .query(`
          UPDATE usuarios SET session_id = NULL WHERE id_usuario = @idusuario;
          UPDATE sesiones_activas 
          SET is_active = 0, fecha_cierre = GETDATE() 
          WHERE id_usuario = @idusuario AND is_active = 1;
        `)
    } catch (newErr) {
      // ignore
    }

    // 2. Invalidar en base previa (fallback)
    try {
      const pool = await getPool()
      await pool.request()
        .input('idusuario', sql.Int, idUsuario)
        .query('UPDATE sisec_usuarios SET sesion_id = NULL WHERE idusuario = @idusuario')
    } catch (oldErr) {
      // ignore
    }

    // 3. Desconectar físicamente el WebSocket
    desconectarUsuario(idUsuario, 'Tu cuenta ha sido cerrada por el administrador.')

    return res.json({ success: true, message: 'Usuario desconectado correctamente.' })
  } catch (error) {
    return next(error)
  }
}
