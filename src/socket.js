import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

let io = null
export const usuariosConectados = new Map() // idUsuario -> { socketId, username, idsede, idpermiso, sesionId }

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    transports: ['polling', 'websocket'],
    cors: {
      origin: (origin, callback) => {
        // Permitir localhost en desarrollo o el origen de CORS configurado
        if (!origin || origin.startsWith('http://localhost:') || origin === 'http://localhost') {
          return callback(null, true)
        }
        const corsOrigins = env.corsOrigin && env.corsOrigin.includes(',')
          ? env.corsOrigin.split(',').map(o => o.trim())
          : env.corsOrigin;
        const allowed = Array.isArray(corsOrigins) ? corsOrigins : [corsOrigins]
        if (allowed.includes(origin)) {
          return callback(null, true)
        }
        callback(null, false)
      },
      credentials: true
    }
  })

  // Middleware del handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('Token de conexión no provisto.'))
    }
    try {
      const decoded = jwt.verify(token, env.jwt.secret)
      socket.usuario = decoded // Contiene idUsuario, nombre, idsede, permiso, sesionId
      next()
    } catch (err) {
      return next(new Error('Token de conexión inválido o expirado.'))
    }
  })

  io.on('connection', (socket) => {
    const { idUsuario, id_usuario, nombre, usuario, idsede, permiso, sesionId } = socket.usuario || {}
    const uid = Number(idUsuario || id_usuario || 0)
    const uname = String(usuario || nombre || '').toLowerCase().trim()

    // Registrar en el mapa activo
    if (uid) {
      usuariosConectados.set(uid, {
        socketId: socket.id,
        username: uname,
        idsede: Number(idsede),
        idpermiso: Number(permiso),
        sesionId
      })
    }

    // Unir a sala privada y a salas por rol
    if (uid) socket.join(`usuario_${uid}`)
    if (Number(permiso) === 1) socket.join('operadores')
    if (Number(permiso) === 2) socket.join('admins')
    if (Number(permiso) === 3) socket.join('superadmins')

    logger.info(`[WS]       🔌 Usuario conectado: ${uname || uid} (Sede: ${idsede}) — Socket: ${socket.id}`)

    // Emitir presencia global a todos los clientes
    broadcastPresencia()

    socket.on('disconnect', () => {
      if (uid) {
        const active = usuariosConectados.get(uid)
        if (active && active.socketId === socket.id) {
          usuariosConectados.delete(uid)
          logger.info(`[WS]       🔌 Usuario desconectado: ${uname || uid} — Socket: ${socket.id}`)
          broadcastPresencia()
        }
      }
    })
  })

  logger.info('[INFO]    🔌 Servidor Socket.io inicializado correctamente')
  return io
}

export const getIo = () => {
  if (!io) {
    throw new Error('Socket.io no ha sido inicializado. Llama initSocket primero.')
  }
  return io
}

// Emite la lista de ids y usernames de usuarios conectados a todos
const broadcastPresencia = () => {
  if (!io) return
  const conectados = Array.from(usuariosConectados.keys()).map(Number)
  const conectadosUsernames = Array.from(usuariosConectados.values()).map(v => v.username).filter(Boolean)
  io.emit('usuarios:estado', { ids: conectados, usernames: conectadosUsernames })
  io.to('superadmins').emit('sesiones_actualizadas', Array.from(usuariosConectados.values()))
}

// Desconecta físicamente a un usuario específico en tiempo real
export const desconectarUsuario = (idUsuario, mensaje = 'Tu sesión ha sido invalidada.') => {
  const conectado = usuariosConectados.get(Number(idUsuario))
  if (conectado) {
    try {
      const socket = io.sockets.sockets.get(conectado.socketId)
      if (socket) {
        socket.emit('sesion:invalidada', { mensaje })
        socket.emit('logout_forced', { reason: mensaje, mensaje })
        socket.disconnect(true)
      }
    } catch (err) {
      logger.error(`[WS_ERROR] Error al desconectar socket para usuario ${idUsuario}: ${err.message}`)
    }
    usuariosConectados.delete(Number(idUsuario))
    broadcastPresencia()
  }
}
