// Controlador de Notificaciones Telegram para Super Admin (SISEC 2027)
import { getTelegramConfig, updateTelegramConfig } from '../models/telegramConfigModel.js'
import { enviarResumenActividad, enviarMensajeAdminASuperadminTelegram } from '../services/telegram.service.js'
import { logger } from '../config/logger.js'

export const getTelegramConfigEndpoint = async (req, res, next) => {
  try {
    const config = await getTelegramConfig()
    return res.json({ success: true, data: config })
  } catch (error) {
    logger.error(`[TELEGRAM_CONFIG] Error al obtener configuración: ${error.message}`)
    return next(error)
  }
}

export const putTelegramConfigEndpoint = async (req, res, next) => {
  try {
    const { activo, resumen_diario, alertas_admin, alertas_errores } = req.body
    const id_usuario = req.user?.idusuario || req.user?.id_usuario || 1

    const updated = await updateTelegramConfig({
      activo: activo ?? true,
      resumen_diario: resumen_diario ?? true,
      alertas_admin: alertas_admin ?? true,
      alertas_errores: alertas_errores ?? true
    }, id_usuario)

    return res.json({
      success: true,
      message: 'Configuración de Telegram actualizada exitosamente.',
      data: updated
    })
  } catch (error) {
    logger.error(`[TELEGRAM_CONFIG] Error al actualizar configuración: ${error.message}`)
    return next(error)
  }
}

export const postTelegramTestEndpoint = async (req, res, next) => {
  try {
    // Forzar el envío de un resumen con corte de prueba
    await enviarResumenActividad('⚡ Corte Manual / Prueba de Notificaciones')
    return res.json({
      success: true,
      message: 'Mensaje de prueba con métricas enviado correctamente al bot de Telegram.'
    })
  } catch (error) {
    logger.error(`[TELEGRAM_TEST] Error al enviar prueba: ${error.message}`)
    return next(error)
  }
}
