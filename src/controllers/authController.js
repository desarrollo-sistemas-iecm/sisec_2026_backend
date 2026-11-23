// Auth controller for SISEC CC 2026
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/env.js'
import { logger, logSession, logWarn, userTag, getPerfilName } from '../config/logger.js'
import { verifyCredentials } from '../models/authModel.js'
import { getNewPool, getPool, sql } from '../config/db.js'
import { desconectarUsuario } from '../socket.js'

export const login = async (req, res, next) => {
  try {
    const { usuario, contrasena } = req.body
    const user = await verifyCredentials(usuario, contrasena)

    if (!user) {
      logWarn(`[AUTH]    ❌ Login fallido — Usuario: ${usuario} (credenciales incorrectas)`) 
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' })
    }

    const sesionId = crypto.randomUUID()
    const ip = req.ip || req.headers['x-forwarded-for'] || '::1'
    const userAgent = (req.headers['user-agent'] || 'Desconocido').substring(0, 255)

    // Si ya existe un socket activo para este usuario, desconectarlo forzosamente
    desconectarUsuario(user.idUsuario, 'Tu cuenta ha sido cerrada porque se inició sesión en otro dispositivo.')

    // Actualizar session_id y registrar en sesiones_activas en la BD operativa 2027
    try {
      const newPool = await getNewPool()
      // 1. Actualizar session_id en usuarios
      await newPool.request()
        .input('sesionId', sql.VarChar(100), sesionId)
        .input('idusuario', sql.Int, user.idUsuario)
        .query('UPDATE usuarios SET session_id = @sesionId WHERE id_usuario = @idusuario')

      // 2. Cerrar sesiones previas activas y registrar la nueva en sesiones_activas
      await newPool.request()
        .input('id_usuario', sql.Int, user.idUsuario)
        .input('token_jti', sql.VarChar(64), sesionId)
        .input('ip_address', sql.VarChar(45), ip.substring(0, 45))
        .input('user_agent', sql.VarChar(255), userAgent)
        .query(`
          UPDATE sesiones_activas 
          SET is_active = 0, fecha_cierre = GETDATE() 
          WHERE id_usuario = @id_usuario AND is_active = 1;

          INSERT INTO sesiones_activas (id_usuario, token_jti, ip_address, user_agent, fecha_inicio, fecha_expiracion, ultima_actividad, is_active)
          VALUES (@id_usuario, @token_jti, @ip_address, @user_agent, GETDATE(), DATEADD(hour, 8, GETDATE()), GETDATE(), 1);
        `)
    } catch (newDbErr) {
      logger.warn(`[AUTH] Advertencia al sincronizar sesión 2027: ${newDbErr.message}`)
    }

    const payload = {
      idUsuario: user.idUsuario,
      id_usuario: user.idUsuario,
      nombre: user.nombre,
      idsede: user.idsede,
      id_distrito: user.idsede,
      permiso: user.permiso,
      id_tipousuario: user.permiso,
      sesionId
    }

    const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn })

    const mostrarAlertaLogin = true

    logSession(`🟢 LOGIN ➜ ${user.nombre} (${usuario}) — ${getPerfilName(user.permiso)} | Sede=${user.idsede} — IP: ${ip}`)
    
    return res.json({ success: true, token, user: payload, mostrarAlertaLogin })
  } catch (error) {
    return next(error)
  }
}


export const logout = async (req, res, next) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || '::1'
    const nombre = req.user?.nombre || 'desconocido'
    const idUsuario = req.user?.idUsuario

    if (idUsuario) {
      const sesionId = req.user?.sesionId

      // 1. Cerrar sesión en BD 2027
      try {
        const newPool = await getNewPool()
        await newPool.request()
          .input('idusuario', sql.Int, idUsuario)
          .input('sesionId', sql.VarChar(100), sesionId || '')
          .query(`
            UPDATE usuarios SET session_id = NULL WHERE id_usuario = @idusuario;
            UPDATE sesiones_activas 
            SET is_active = 0, fecha_cierre = GETDATE() 
            WHERE id_usuario = @idusuario AND (token_jti = @sesionId OR is_active = 1);
          `)
      } catch (err2027) {
        // ignore
      }

      // 2. Remover sesion_id en la base de datos previa
      try {
        const pool = await getPool()
        await pool.request()
          .input('idusuario', sql.Int, idUsuario)
          .query('UPDATE sisec_usuarios SET sesion_id = NULL WHERE idusuario = @idusuario')
      } catch (errPrev) {
        // ignore
      }

      // Desconectar el socket
      desconectarUsuario(idUsuario, 'Has cerrado tu sesión.')
    }

    logSession(`🔴 LOGOUT ➜ ${nombre} — IP: ${ip}`)
    return res.json({ success: true })
  } catch (error) {
    return next(error)
  }
}
