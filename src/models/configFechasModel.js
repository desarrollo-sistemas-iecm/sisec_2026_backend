// ConfigFechas model for SISEC CC 2027
import { getNewPool, sql } from '../config/db.js'
import { logger } from '../config/logger.js'

export const getConfigFechas = async () => {
  try {
    const pool = await getNewPool()
    const result = await pool.request().query(`
      SELECT 
        id_config AS id,
        tipo_alcance AS modulo,
        format(fecha_hora_apertura, 'yyyy-MM-dd') as fecha_inicio,
        format(fecha_hora_cierre, 'yyyy-MM-dd') as fecha_fin,
        format(ISNULL(fecha_limite, DATEADD(day, 5, ISNULL(fecha_alta, GETDATE()))), 'yyyy-MM-dd') as fecha_limite,
        status AS habilitado,
        ISNULL(id_distrito, 0) AS idsede,
        ISNULL(fecha_modif, fecha_alta) AS fecha_actualizado
      FROM config_fechas_acceso
      WHERE tipo_alcance IN ('captura', 'programacion', 'ambos')
      ORDER BY id_config DESC
    `)
    return result.recordset
  } catch (error) {
    logger.error(`[CONFIG_FECHAS] Error al obtener excepciones: ${error.message}`)
    return []
  }
}

export const updateConfigFechas = async (modulo, fecha_inicio, fecha_fin, habilitado, idsede, idusuario_actualizo, fecha_limite = null) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()

    // Si fecha_limite no viene o está vacía, calculamos por defecto 5 días a partir de hoy
    let finalFechaLimite = fecha_limite
    if (!finalFechaLimite) {
      const d = new Date()
      d.setDate(d.getDate() + 5)
      finalFechaLimite = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    // Si idsede es 0 (Todos los distritos), se inserta NULL para respetar FK con cat_distritos
    const targetDistrito = Number(idsede) > 0 ? Number(idsede) : null

    request.input('descripcion', sql.VarChar(200), `Configuración ${modulo}`)
    request.input('tipo_alcance', sql.VarChar(50), modulo)
    request.input('id_distrito', sql.Int, targetDistrito)
    request.input('fecha_apertura', sql.DateTime, `${fecha_inicio} 00:00:00`)
    request.input('fecha_cierre', sql.DateTime, `${fecha_fin} 23:59:59`)
    request.input('fecha_limite', sql.DateTime, `${finalFechaLimite} 23:59:59`)
    request.input('status', sql.Bit, habilitado ? 1 : 0)

    await request.query(`
      INSERT INTO config_fechas_acceso (
        descripcion, tipo_alcance, id_distrito, fecha_hora_apertura, fecha_hora_cierre, fecha_limite, permite_superadmin, status, fecha_alta
      ) VALUES (
        @descripcion, @tipo_alcance, @id_distrito, @fecha_apertura, @fecha_cierre, @fecha_limite, 1, @status, GETDATE()
      )
    `)
  } catch (error) {
    logger.error(`[CONFIG_FECHAS] Error al insertar excepción: ${error.message}`)
    throw error
  }
}

export const editConfigFecha = async (id, fecha_limite, fecha_inicio = null, fecha_fin = null) => {
  try {
    const pool = await getNewPool()
    const req = pool.request()
    req.input('id', sql.Int, Number(id))
    req.input('fecha_limite', sql.DateTime, `${fecha_limite} 23:59:59`)

    let extraSql = ''
    if (fecha_inicio) {
      req.input('fecha_inicio', sql.DateTime, `${fecha_inicio} 00:00:00`)
      extraSql += ', fecha_hora_apertura = @fecha_inicio'
    }
    if (fecha_fin) {
      req.input('fecha_fin', sql.DateTime, `${fecha_fin} 23:59:59`)
      extraSql += ', fecha_hora_cierre = @fecha_fin'
    }

    await req.query(`
      UPDATE config_fechas_acceso
      SET fecha_limite = @fecha_limite,
          fecha_modif = GETDATE()
          ${extraSql}
      WHERE id_config = @id
    `)
  } catch (error) {
    logger.error(`[CONFIG_FECHAS] Error al editar excepción: ${error.message}`)
    throw error
  }
}

export const deleteConfigFechasById = async (id) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()
    request.input('id', sql.Int, id)
    await request.query(`
      DELETE FROM config_fechas_acceso WHERE id_config = @id
    `)
  } catch (error) {
    logger.error(`[CONFIG_FECHAS] Error al eliminar excepción: ${error.message}`)
    throw error
  }
}

export const isFechaHabilitada = async (modulo, fechaSeleccionada, idsede = 0) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()
    request.input('fecha', sql.Date, fechaSeleccionada)
    request.input('id_distrito', sql.Int, Number(idsede) || 0)
    request.input('modulo', sql.VarChar(50), modulo)

    const res = await request.query(`
      SELECT TOP 1 status 
      FROM config_fechas_acceso
      WHERE status = 1
        AND (tipo_alcance = @modulo OR tipo_alcance = 'ambos' OR tipo_alcance = 'captura,programacion')
        AND (id_distrito IS NULL OR id_distrito = 0 OR id_distrito = @id_distrito)
        AND @fecha BETWEEN CAST(fecha_hora_apertura AS DATE) AND CAST(fecha_hora_cierre AS DATE)
        AND (fecha_limite IS NULL OR CAST(GETDATE() AS DATE) <= CAST(fecha_limite AS DATE))
    `)

    if (res.recordset.length > 0) {
      return true
    }

    // Regla del Mes Vigente por defecto:
    if (fechaSeleccionada) {
      const [yearStr, monthStr] = String(fechaSeleccionada).split('-')
      const actYear = Number(yearStr)
      const actMonth = Number(monthStr)

      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1

      if (actYear === currentYear && actMonth === currentMonth) {
        return true
      }
    }

    // Si la fecha es de un mes anterior y no está habilitada por excepción
    return false
  } catch (error) {
    logger.error(`[CONFIG_FECHAS] Error en isFechaHabilitada: ${error.message}`)
    return false
  }
}
