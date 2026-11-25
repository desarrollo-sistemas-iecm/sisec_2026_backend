// Modelo de Configuración de Notificaciones Telegram para Super Admin (SISEC 2027)
import { getNewPool, sql } from '../config/db.js'
import { env } from '../config/env.js'

// Inicializar tabla si no existe
let tableChecked = false
async function ensureTable(pool) {
  if (tableChecked) return
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'config_telegram')
    BEGIN
      CREATE TABLE config_telegram (
        id_config INT IDENTITY(1,1) PRIMARY KEY,
        activo BIT NOT NULL DEFAULT 1,
        resumen_diario BIT NOT NULL DEFAULT 1,
        alertas_admin BIT NOT NULL DEFAULT 1,
        alertas_errores BIT NOT NULL DEFAULT 1,
        fecha_modif DATETIME NULL,
        id_usuario_modif INT NULL
      );
      INSERT INTO config_telegram (activo, resumen_diario, alertas_admin, alertas_errores, fecha_modif)
      VALUES (1, 1, 1, 1, GETDATE());
    END
  `)
  tableChecked = true
}

export const getTelegramConfig = async () => {
  try {
    const pool = await getNewPool()
    await ensureTable(pool)

    const result = await pool.request().query(`
      SELECT TOP 1 
        id_config,
        activo,
        resumen_diario,
        alertas_admin,
        alertas_errores,
        fecha_modif,
        id_usuario_modif
      FROM config_telegram
      ORDER BY id_config DESC
    `)

    if (result.recordset.length === 0) {
      return {
        activo: true,
        resumen_diario: true,
        alertas_admin: true,
        alertas_errores: true,
        bot_configurado: !!env.telegram?.botToken,
        chat_id: env.telegram?.chatId || null
      }
    }

    const row = result.recordset[0]
    return {
      id_config: row.id_config,
      activo: Boolean(row.activo),
      resumen_diario: Boolean(row.resumen_diario),
      alertas_admin: Boolean(row.alertas_admin),
      alertas_errores: Boolean(row.alertas_errores),
      fecha_modif: row.fecha_modif,
      id_usuario_modif: row.id_usuario_modif,
      bot_configurado: !!env.telegram?.botToken,
      chat_id: env.telegram?.chatId || null,
      ambiente: env.nodeEnv || 'development'
    }
  } catch (error) {
    // Si falla la consulta, retornar fallback activo para no romper el servicio
    return {
      activo: true,
      resumen_diario: true,
      alertas_admin: true,
      alertas_errores: true,
      bot_configurado: !!env.telegram?.botToken,
      chat_id: env.telegram?.chatId || null,
      ambiente: env.nodeEnv || 'development'
    }
  }
}

export const updateTelegramConfig = async (payload, id_usuario) => {
  const pool = await getNewPool()
  await ensureTable(pool)

  const req = pool.request()
  req.input('activo', sql.Bit, payload.activo ? 1 : 0)
  req.input('resumen_diario', sql.Bit, payload.resumen_diario ? 1 : 0)
  req.input('alertas_admin', sql.Bit, payload.alertas_admin ? 1 : 0)
  req.input('alertas_errores', sql.Bit, payload.alertas_errores ? 1 : 0)
  req.input('id_usuario', sql.Int, id_usuario || null)

  await req.query(`
    IF EXISTS (SELECT 1 FROM config_telegram)
    BEGIN
      UPDATE config_telegram
      SET 
        activo = @activo,
        resumen_diario = @resumen_diario,
        alertas_admin = @alertas_admin,
        alertas_errores = @alertas_errores,
        fecha_modif = GETDATE(),
        id_usuario_modif = @id_usuario
    END
    ELSE
    BEGIN
      INSERT INTO config_telegram (activo, resumen_diario, alertas_admin, alertas_errores, fecha_modif, id_usuario_modif)
      VALUES (@activo, @resumen_diario, @alertas_admin, @alertas_errores, GETDATE(), @id_usuario)
    END
  `)

  return await getTelegramConfig()
}
