import { listUsuarios, createUsuario, updateUsuario, deleteUsuario } from '../models/usuarioModel.js'
import { usuariosConectados, desconectarUsuario } from '../socket.js'
import { getNewPool, getPool, sql } from '../config/db.js'

export const getUsuarios = async (req, res, next) => {
  try {
    const data = await listUsuarios()
    const currentUserId = Number(req.user?.idUsuario || req.user?.id_usuario || 0)
    const currentUsername = String(req.user?.usuario || req.user?.nombre || '').toLowerCase().trim()
    const userPermiso = Number(req.user?.permiso || req.user?.idpermiso || 0)

    // Si es Administrador (permiso 2): solo puede ver su cuenta y las de los distritos (ocultar Super Administradores)
    let filteredData = data
    if (userPermiso === 2) {
      filteredData = data.filter(u => {
        const uid = Number(u.idusuario || u.id_usuario || 0)
        const isMe = uid === currentUserId
        const isDistrito = Number(u.idpermiso || u.id_tipousuario) === 1
        return isMe || isDistrito
      })
    }

    const enrichedData = filteredData.map(u => {
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
    const userPermiso = Number(req.user?.permiso || req.user?.idpermiso)
    if (userPermiso !== 3) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo un Super Administrador puede crear usuarios.' })
    }
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
    const targetId = Number(req.params.id)

    // Restricciones para Administrador (permiso 2):
    // Solo puede editar contraseña y activar/desactivar status de cuentas distritales o propia
    if (userPermiso === 2) {
      const pool = await getNewPool()
      const chk = await pool.request().input('id', sql.Int, targetId).query(`
        SELECT id_tipousuario, usuario FROM usuarios WHERE id_usuario = @id
      `)
      if (chk.recordset.length > 0 && Number(chk.recordset[0].id_tipousuario) === 3) {
        return res.status(403).json({ success: false, message: 'Acceso denegado. No tienes permisos para modificar usuarios Super Administrador.' })
      }

      const allowedPayload = {}
      if (req.body.password) allowedPayload.password = req.body.password
      if (req.body.status !== undefined) allowedPayload.status = req.body.status

      await updateUsuario(targetId, allowedPayload)
      return res.json({ success: true, message: 'Usuario actualizado exitosamente' })
    }

    if (userPermiso !== 3 && Number(req.body.idpermiso) === 3) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo un Super Administrador puede asignar el rol de Super Administrador.' })
    }
    await updateUsuario(targetId, req.body)
    return res.json({ success: true, message: 'Usuario actualizado exitosamente' })
  } catch (error) {
    return next(error)
  }
}

export const delUsuario = async (req, res, next) => {
  try {
    const userPermiso = Number(req.user?.permiso || req.user?.idpermiso)
    if (userPermiso !== 3) {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Únicamente el Super Administrador puede eliminar usuarios.' })
    }
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
