// JWT auth middleware for SISEC CC 2026
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { getNewPool, getPool, sql } from '../config/db.js'
import { logger, logError } from '../config/logger.js'

export const auth = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header) {
    return res.status(401).json({ success: false, message: 'Token requerido.', code: 'UNAUTHORIZED' })
  }

  const token = header.replace('Bearer ', '')
  try {
    const decoded = jwt.verify(token, env.jwt.secret)
    const userId = Number(decoded.id_usuario || decoded.idUsuario)
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Token inválido.', code: 'UNAUTHORIZED' })
    }

    const newPool = await getNewPool()
    const newReq = newPool.request()
    newReq.input('id', sql.Int, userId)
    const newRes = await newReq.query('SELECT id_usuario, usuario, session_id, status, id_tipousuario, id_distrito FROM usuarios WHERE id_usuario = @id')
    
    if (newRes.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario inexistente o dado de baja.', code: 'UNAUTHORIZED' })
    }

    const u = newRes.recordset[0]
    if (!u.status) {
      return res.status(401).json({ success: false, message: 'Usuario inactivo.', code: 'USER_INACTIVE' })
    }

    // Si tiene un session_id registrado y no coincide con el del token, la sesión caducó
    if (u.session_id && decoded.sesionId && u.session_id !== decoded.sesionId) {
      return res.status(401).json({
        success: false,
        message: 'Tu sesión ha sido cerrada porque iniciaste sesión en otro dispositivo. Por favor, inicia sesión de nuevo.',
        code: 'SESION_INVALIDADA'
      })
    }

    // Actualizar última actividad de forma asíncrona en sesiones_activas
    if (decoded.sesionId) {
      newPool.request()
        .input('jti', sql.VarChar(64), decoded.sesionId)
        .query('UPDATE sesiones_activas SET ultima_actividad = GETDATE() WHERE token_jti = @jti AND is_active = 1')
        .catch(() => {})
    }

    req.user = {
      ...decoded,
      idUsuario: u.id_usuario,
      id_usuario: u.id_usuario,
      nombre: u.usuario,
      permiso: u.id_tipousuario,
      id_tipousuario: u.id_tipousuario,
      idsede: u.id_distrito,
      id_distrito: u.id_distrito
    }

    // Si es usuario distrital (operador, id_tipousuario === 1), verificar si el sistema está en periodo de cierre
    if (Number(u.id_tipousuario) === 1) {
      try {
        const cierreRes = await newPool.request().query(`
          SELECT TOP 1 fecha_hora_cierre, fecha_hora_apertura, mensaje_bloqueo, status
          FROM config_fechas_acceso
          WHERE tipo_alcance = 'cierre_sistema' AND status = 1
          ORDER BY id_config DESC
        `)
        if (cierreRes.recordset.length > 0) {
          const config = cierreRes.recordset[0]
          const now = new Date()
          const fCierre = config.fecha_hora_cierre ? new Date(config.fecha_hora_cierre) : null
          const fApertura = config.fecha_hora_apertura ? new Date(config.fecha_hora_apertura) : null

          let bloqueado = false
          if (fApertura && fCierre) {
            const dInicio = new Date(Math.min(fApertura.getTime(), fCierre.getTime()))
            const dFin = new Date(Math.max(fApertura.getTime(), fCierre.getTime()))
            bloqueado = !(now >= dInicio && now <= dFin)
          } else if (fCierre) {
            bloqueado = now > fCierre
          } else if (fApertura) {
            bloqueado = now < fApertura
          } else {
            bloqueado = true
          }

          if (bloqueado) {
            return res.status(403).json({
              success: false,
              cierre_sistema: true,
              message: config.mensaje_bloqueo || 'El sistema se encuentra en periodo de cierre institucional programado conforme a la normativa. Reanudación de servicio próximamente.',
              code: 'CIERRE_SISTEMA'
            })
          }
        }
      } catch {
        // En caso de incidencia en verificación secundaria, no bloquear
      }
    }

    return next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token inválido o expirado.', code: 'TOKEN_EXPIRED' })
    }
    
    logError({
      message: error.message,
      where: `[AUTH] ${req.method} ${req.originalUrl}`,
      ip: req.ip || req.socket?.remoteAddress,
      status: 500,
      stack: error.stack
    })
    return res.status(500).json({
      success: false,
      message: 'No se pudo verificar el estado de la sesión, por favor intente de nuevo.'
    })
  }
}

export const isSuperAdmin = (req, res, next) => {
  const permiso = Number(req.user?.permiso || req.user?.idpermiso || req.user?.id_tipousuario || 1)
  if (permiso === 3) {
    return next()
  }
  return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere nivel de Super Administrador.' })
}

export const isAdmin = (req, res, next) => {
  const permiso = Number(req.user?.permiso || req.user?.idpermiso || req.user?.id_tipousuario || 1)
  if (permiso >= 2) {
    return next()
  }
  return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere nivel de Administrador.' })
}
