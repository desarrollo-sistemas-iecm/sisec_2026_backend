// Auth controller for SISEC CC 2026
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/env.js'
import { logger, logSession, logWarn, userTag, getPerfilName } from '../config/logger.js'
import { verifyCredentials } from '../models/authModel.js'
import { getNewPool, getPool, sql } from '../config/db.js'
import { desconectarUsuario } from '../socket.js'
import { MODULOS_DEFAULT_DISTRITO, MODULOS_DEFAULT_ADMIN, MODULOS_SISTEMA } from './permisosController.js'

export const login = async (req, res, next) => {
  try {
    const { usuario, contrasena } = req.body
    const user = await verifyCredentials(usuario, contrasena)

    if (!user) {
      logWarn(`[AUTH]    ❌ Login fallido — Usuario: ${usuario} (credenciales incorrectas)`) 
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' })
    }

    // Validar ventana de cierre programado del sistema (Inicio de sesión)
    try {
      const pool = await getNewPool()
      const cierreRes = await pool.request().query(`
        SELECT TOP 1 fecha_hora_cierre, fecha_hora_apertura, mensaje_bloqueo, status, permite_superadmin
        FROM config_fechas_acceso
        WHERE tipo_alcance = 'cierre_sistema' AND status = 1
        ORDER BY id_config DESC
      `)

      if (cierreRes.recordset.length > 0) {
        const config = cierreRes.recordset[0]
        const now = new Date()
        const fCierre = config.fecha_hora_cierre ? new Date(config.fecha_hora_cierre) : null
        const fApertura = config.fecha_hora_apertura ? new Date(config.fecha_hora_apertura) : null

        // Bloqueo ÚNICAMENTE para cuentas distritales (permiso = 1 / operador)
        const isDistrital = Number(user.permiso || user.id_tipousuario) === 1
        if (isDistrital) {
          let bloqueado = false
          if (fApertura && fCierre) {
            const dInicio = new Date(Math.min(fApertura.getTime(), fCierre.getTime()))
            const dFin = new Date(Math.max(fApertura.getTime(), fCierre.getTime()))
            // El sistema está abierto solo en el rango [dInicio, dFin].
            // Si la fecha actual ya superó el cierre o aún no abre, se bloquea.
            bloqueado = !(now >= dInicio && now <= dFin)
          } else if (fCierre) {
            // Si solo se especificó fecha de cierre y ya pasó, el sistema cerró
            bloqueado = now > fCierre
          } else if (fApertura) {
            // Si solo se especificó fecha de apertura y aún no llega, el sistema no ha abierto
            bloqueado = now < fApertura
          } else {
            bloqueado = true
          }

          if (bloqueado) {
            const msg = config.mensaje_bloqueo || 'El sistema se encuentra en periodo de cierre institucional programado conforme a la normativa. Reanudación de servicio próximamente.'
            logWarn(`[AUTH] ⛔ Acceso distrital bloqueado por cierre institucional programado — Usuario: ${usuario}`)
            return res.status(403).json({
              success: false,
              cierre_sistema: true,
              message: msg,
              fecha_cierre: config.fecha_hora_cierre,
              fecha_apertura: config.fecha_hora_apertura
            })
          }
        }
      }
    } catch (cierreErr) {
      logger.warn(`[AUTH] Error validando cierre programado: ${cierreErr.message}`)
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

    // Determinar módulos permitidos para el usuario
    let modulosUsuario = []
    try {
      const pool = await getNewPool()
      const permRes = await pool.request()
        .input('id_usuario', sql.Int, user.idUsuario)
        .query(`
          SELECT DISTINCT p.id_modulo, m.codigo AS codigo_modulo
          FROM rel_usuario_permisos p
          LEFT JOIN cat_modulos m ON p.id_modulo = m.id_modulo
          WHERE p.id_usuario = @id_usuario AND p.permitido = 1
        `)
      if (permRes.recordset.length > 0) {
        modulosUsuario = permRes.recordset.map(row => {
          if (row.codigo_modulo) return row.codigo_modulo.toLowerCase()
          const matched = MODULOS_SISTEMA.find(m => m.id_modulo === row.id_modulo)
          return matched ? matched.codigo : null
        }).filter(Boolean)
      }
    } catch (e) {
      // ignore
    }

    if (modulosUsuario.length === 0) {
      modulosUsuario = Number(user.permiso) === 1 ? [...MODULOS_DEFAULT_DISTRITO] : [...MODULOS_DEFAULT_ADMIN]
    }

    const payload = {
      idUsuario: user.idUsuario,
      id_usuario: user.idUsuario,
      nombre: user.nombre,
      idsede: (Number(user.permiso) >= 2 || user.idsede === 0 || user.usuario === 'admin') ? 0 : user.idsede,
      id_distrito: (Number(user.permiso) >= 2 || user.idsede === 0 || user.usuario === 'admin') ? 0 : user.idsede,
      permiso: user.permiso,
      id_tipousuario: user.permiso,
      modulos: modulosUsuario,
      sesionId
    }

    const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn })

    let mostrarAlertaLogin = false
    try {
      const pool = await getNewPool()
      const alertaRes = await pool.request().query("SELECT TOP 1 status FROM config_fechas_acceso WHERE tipo_alcance = 'alerta_login'")
      if (alertaRes.recordset.length > 0) {
        mostrarAlertaLogin = Boolean(alertaRes.recordset[0].status)
      }
    } catch (e) {
      mostrarAlertaLogin = false
    }

    logSession(`🟢 LOGIN ➜ ${user.nombre} (${usuario}) — ${getPerfilName(user.permiso)} | Sede=${user.idsede} — IP: ${ip}`)
    
    return res.json({ success: true, token, user: payload, mostrarAlertaLogin })
  } catch (error) {
    if (error.code === 'CUENTA_DESACTIVADA') {
      return res.status(403).json({ success: false, message: error.message })
    }
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
