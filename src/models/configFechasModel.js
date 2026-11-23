// ConfigFechas model for SISEC CC 2027
import { getNewPool, sql } from '../config/db.js'

export const getConfigFechas = async () => {
  try {
    const pool = await getNewPool()
    const result = await pool.request().query(`
      SELECT 
        id_config AS id,
        tipo_alcance AS modulo,
        format(fecha_hora_apertura, 'yyyy-MM-dd') as fecha_inicio,
        format(fecha_hora_cierre, 'yyyy-MM-dd') as fecha_fin,
        format(fecha_hora_cierre, 'yyyy-MM-dd') as fecha_limite,
        status AS habilitado,
        ISNULL(id_distrito, 0) AS idsede,
        ISNULL(fecha_modif, fecha_alta) AS fecha_actualizado
      FROM config_fechas_acceso
    `)
    return result.recordset
  } catch (error) {
    return []
  }
}

export const updateConfigFechas = async (modulo, fecha_inicio, fecha_fin, habilitado, idsede, idusuario_actualizo, fecha_limite = null) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()

    request.input('descripcion', sql.VarChar(200), `Configuración ${modulo}`)
    request.input('tipo_alcance', sql.VarChar(50), modulo)
    request.input('id_distrito', sql.Int, Number(idsede) || 0)
    request.input('fecha_apertura', sql.DateTime, `${fecha_inicio} 00:00:00`)
    request.input('fecha_cierre', sql.DateTime, `${fecha_fin} 23:59:59`)
    request.input('status', sql.Bit, habilitado ? 1 : 0)

    await request.query(`
      INSERT INTO config_fechas_acceso (
        descripcion, tipo_alcance, id_distrito, fecha_hora_apertura, fecha_hora_cierre, permite_superadmin, status, fecha_alta
      ) VALUES (
        @descripcion, @tipo_alcance, @id_distrito, @fecha_apertura, @fecha_cierre, 1, @status, GETDATE()
      )
    `)
  } catch (error) {
    // Graceful error handling
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
  } catch (error) {}
}

export const isFechaHabilitada = async (modulo, fechaSeleccionada, idsede = 0) => {
  try {
    const pool = await getNewPool()
    const request = pool.request()
    request.input('fecha', sql.Date, fechaSeleccionada)
    request.input('id_distrito', sql.Int, Number(idsede) || 0)

    const res = await request.query(`
      SELECT TOP 1 status 
      FROM config_fechas_acceso
      WHERE status = 1
        AND (id_distrito = 0 OR id_distrito IS NULL OR id_distrito = @id_distrito)
        AND @fecha BETWEEN CAST(fecha_hora_apertura AS DATE) AND CAST(fecha_hora_cierre AS DATE)
    `)

    if (res.recordset.length > 0) {
      return true
    }

    // Regla del Mes Vigente por defecto
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

    return true
  } catch (error) {
    return true
  }
}

