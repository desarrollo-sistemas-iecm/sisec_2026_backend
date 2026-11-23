// Environment loader for SISEC CC 2026
import dotenv from 'dotenv'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envName = process.env.NODE_ENV || 'development'
const envFile = `.env.${envName}`

// Cargar .env resolviendo tanto process.cwd() como la raíz de backend
const envPathCwd = path.resolve(process.cwd(), envFile)
const envPathBackend = path.resolve(__dirname, '../../', envFile)

if (fs.existsSync(envPathCwd)) {
  dotenv.config({ path: envPathCwd })
} else if (fs.existsSync(envPathBackend)) {
  dotenv.config({ path: envPathBackend })
} else {
  dotenv.config()
}

// Función para obtener la IP activa de la máquina
const getLocalIp = () => {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

const ip = getLocalIp()

// Resolver puerto configurado
const resolvedPort = parseInt(process.env.PORT, 10) || ((ip === '145.0.40.48') ? 3013 : 3014)

export const env = {
  nodeEnv: envName,
  port: resolvedPort,
  ip: ip,
  appUrl: process.env.APP_URL || 'https://aplicaciones2qa.iecm.mx/sisec_2026',
  backendUrl: process.env.BACKEND_URL || 'https://aplicaciones2qa.iecm.mx/sisec_2026',
  db: {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 1433)
  },
  dbHistorical: {
    server: process.env.DB_HISTORICAL_SERVER || process.env.DB_SERVER,
    database: process.env.DB_HISTORICAL_DATABASE || 'sisecycc2024',
    user: process.env.DB_HISTORICAL_USER || process.env.DB_USER,
    password: process.env.DB_HISTORICAL_PASSWORD || process.env.DB_PASSWORD,
    port: Number(process.env.DB_HISTORICAL_PORT || process.env.DB_PORT || 1433)
  },
  dbNew: {
    server: process.env.DB_NEW_SERVER || process.env.DB_SERVER,
    database: process.env.DB_NEW_DATABASE || 'sisec_2027_dev',
    user: process.env.DB_NEW_USER || process.env.DB_USER,
    password: process.env.DB_NEW_PASSWORD || process.env.DB_PASSWORD,
    port: Number(process.env.DB_NEW_PORT || process.env.DB_PORT || 1433)
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN
  },
  corsOrigin: process.env.CORS_ORIGIN,
  logLevel: process.env.LOG_LEVEL || 'info',
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID
  }
}

