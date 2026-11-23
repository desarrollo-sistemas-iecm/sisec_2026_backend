// SQL Server dual connection manager for SISEC CC 2026 / 2027
import sql from 'mssql'
import { env } from './env.js'
import { logger } from './logger.js'

let defaultPool = null
let historicalPool = null
let newPool = null

const createConfig = (dbEnv) => ({
  user: dbEnv.user,
  password: dbEnv.password,
  server: dbEnv.server,
  database: dbEnv.database,
  port: dbEnv.port,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
})

export const getHistoricalPool = async () => {
  try {
    if (!historicalPool) {
      const cfg = createConfig(env.dbHistorical)
      historicalPool = new sql.ConnectionPool(cfg)
      await historicalPool.connect()
      logger.info(`[BD] 📦 Conexión establecida a BD Histórica: ${env.dbHistorical.database}`)
    }
    return historicalPool
  } catch (error) {
    logger.warn(`[BD] ⚠️ No se pudo conectar a BD Histórica (${env.dbHistorical.database}), usando pool principal: ${error.message}`)
    historicalPool = null
    return getPool()
  }
}

export const getNewPool = async () => {
  try {
    if (!newPool) {
      const cfg = createConfig(env.dbNew)
      newPool = new sql.ConnectionPool(cfg)
      await newPool.connect()
      logger.info(`[BD] 🚀 Conexión establecida a BD Nueva 2027: ${env.dbNew.database}`)
    }
    return newPool
  } catch (error) {
    logger.warn(`[BD] ⚠️ No se pudo conectar a BD 2027 (${env.dbNew.database}), usando pool principal: ${error.message}`)
    newPool = null
    return getPool()
  }
}

export const getPool = async () => {
  try {
    if (!defaultPool) {
      const cfg = createConfig(env.db)
      defaultPool = new sql.ConnectionPool(cfg)
      await defaultPool.connect()
    }
    return defaultPool
  } catch (error) {
    logger.error(`[ERROR] 💥 Error de conexión BD principal — ${error.message}`)
    defaultPool = null
    throw error
  }
}

export const connectDb = async () => {
  return getPool()
}

export { sql }
