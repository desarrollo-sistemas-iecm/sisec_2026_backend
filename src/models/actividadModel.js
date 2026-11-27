// Actividad model for SISEC CC 2026 / 2027
import path from 'path'
import fs from 'fs/promises'
import { getPool, getNewPool, sql } from '../config/db.js'
import { env } from '../config/env.js'

const findFolderForFile = async (baseDir, filename) => {
  if (!filename) return null
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const candidate = path.join(baseDir, entry.name, filename)
      try {
        await fs.access(candidate)
        return entry.name
      } catch {
        continue
      }
    }
  } catch {
    return null
  }
  return null
}

function colorDesdeId(idcatcurso) {
  const hue = (idcatcurso * 137.5) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

export const listActividadesBySede = async (idsede) => {
  const pool = await getPool()
  const request = pool.request()

  request.input('idsede', sql.TinyInt, idsede)

  const result = await request.query(`
      SELECT ti.idcurso,
        ti.fecha,
        ti.fecha_alta,
        ti.hora_programada,
        ti.duracionhrs,
        ti.duracionmin,
        ti.status,
        ti.lugar AS institucion,
        cc.descripcion AS curso,
        ti.idcatcurso,
        ti.comentarios,
        ti.modalidad,
        ti.pmujeres1, ti.pmujeres2, ti.pmujeres3, ti.pmujeres4,
        ti.pmujeres5, ti.pmujeres6, ti.pmujeres7, ti.pmujeres8,
        ti.phombres1, ti.phombres2, ti.phombres3, ti.phombres4,
        ti.phombres5, ti.phombres6, ti.phombres7, ti.phombres8,
        ti.nombre_archivo, ti.nombre_archivo2, ti.nombre_archivo3,
        cc.color,
        u.idsede
    FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
      LEFT JOIN sisecycc2024.dbo.sisec_cat_cursos cc ON ti.idcatcurso = cc.idcurso
    INNER JOIN sisec_usuarios u ON ti.idusuario = u.idusuario
    WHERE u.idsede = @idsede AND ti.status IN (1, 3)
    ORDER BY ti.status, ti.fecha DESC
  `)

  const baseDir = path.resolve(env.uploadPath, `DTO-${idsede}`)

  return Promise.all(
    result.recordset.map(async (row) => {
      const target = row.nombre_archivo || row.nombre_archivo2 || row.nombre_archivo3
      const carpeta = await findFolderForFile(baseDir, target)
      const color = row.color || colorDesdeId(row.idcatcurso || 0)
      return { ...row, carpeta, color }
    })
  )
}

export const getActividadContext = async (idcurso) => {
  const pool = await getPool()
  const request = pool.request()

  request.input('idcurso', sql.Int, idcurso)

  const result = await request.query(`
    SELECT ti.idcurso, ti.idcatcurso, cc.idtipo, ti.fecha, ti.id_distrito, u.idsede
    FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
    LEFT JOIN sisecycc2024.dbo.sisec_cat_cursos cc ON ti.idcatcurso = cc.idcurso
    LEFT JOIN sisec_usuarios u ON ti.idusuario = u.idusuario
    WHERE ti.idcurso = @idcurso
  `)

  const row = result.recordset[0]
  if (!row) return null

  let fechaStr = row.fecha
  if (fechaStr instanceof Date) {
    fechaStr = fechaStr.toISOString().slice(0, 10)
  } else if (typeof fechaStr === 'string') {
    fechaStr = fechaStr.slice(0, 10)
  }

  return {
    ...row,
    fecha: fechaStr
  }
}

export const getArchivosActuales = async (idcurso) => {
  const pool = await getPool()
  const request = pool.request()

  request.input('idcurso', sql.Int, idcurso)

  const result = await request.query(`
    SELECT nombre_archivo, nombre_archivo2, nombre_archivo3
    FROM sisecycc2024.dbo.sisec_talleres_intervenciones
    WHERE idcurso = @idcurso
  `)

  return result.recordset[0] || {}
}

export const marcarNoRealizada = async (idcurso, motivo) => {
  const pool = await getPool()
  const request = pool.request()

  request.input('idcurso', sql.Int, idcurso)
  request.input('motivo', sql.VarChar(250), motivo ? motivo.slice(0, 250) : '')

  await request.query(`
    UPDATE sisecycc2024.dbo.sisec_talleres_intervenciones
    SET motivo_norealizada = @motivo, status = 2
    WHERE idcurso = @idcurso
  `)
}

export const reprogramarActividad = async (idcurso, fecha, hora) => {
  const pool = await getPool()
  const request = pool.request()

  request.input('idcurso', sql.Int, idcurso)
  request.input('fecha', sql.VarChar(10), fecha)
  request.input('hora', sql.VarChar(10), hora)

  await request.query(`
    UPDATE sisecycc2024.dbo.sisec_talleres_intervenciones
    SET fecha = @fecha, hora_programada = @hora
    WHERE idcurso = @idcurso
  `)
}

export const marcarRealizada = async (idcurso, payload) => {
  const pool = await getPool()
  const request = pool.request()

  request.input('idcurso', sql.Int, idcurso)
  request.input('modalidad', sql.Bit, payload.modalidad)
  request.input('duracionhrs', sql.Int, payload.duracionhrs)
  request.input('duracionmin', sql.Int, payload.duracionmin)
  request.input('comentarios', sql.VarChar(250), payload.comentarios ? payload.comentarios.slice(0, 250) : '')
  request.input('pmujeres1', sql.Int, payload.pmujeres1)
  request.input('pmujeres2', sql.Int, payload.pmujeres2)
  request.input('pmujeres3', sql.Int, payload.pmujeres3)
  request.input('pmujeres4', sql.Int, payload.pmujeres4)
  request.input('pmujeres5', sql.Int, payload.pmujeres5)
  request.input('pmujeres6', sql.Int, payload.pmujeres6)
  request.input('pmujeres7', sql.Int, payload.pmujeres7)
  request.input('pmujeres8', sql.Int, payload.pmujeres8)
  request.input('phombres1', sql.Int, payload.phombres1)
  request.input('phombres2', sql.Int, payload.phombres2)
  request.input('phombres3', sql.Int, payload.phombres3)
  request.input('phombres4', sql.Int, payload.phombres4)
  request.input('phombres5', sql.Int, payload.phombres5)
  request.input('phombres6', sql.Int, payload.phombres6)
  request.input('phombres7', sql.Int, payload.phombres7)
  request.input('phombres8', sql.Int, payload.phombres8)
  request.input('nombre_archivo', sql.VarChar(80), payload.nombre_archivo)
  request.input('nombre_archivo2', sql.VarChar(80), payload.nombre_archivo2)
  request.input('nombre_archivo3', sql.VarChar(80), payload.nombre_archivo3)

  await request.query(`
    UPDATE sisecycc2024.dbo.sisec_talleres_intervenciones
    SET modalidad = @modalidad,
        duracionhrs = @duracionhrs,
        duracionmin = @duracionmin,
        comentarios = @comentarios,
        pmujeres1 = @pmujeres1,
        pmujeres2 = @pmujeres2,
        pmujeres3 = @pmujeres3,
        pmujeres4 = @pmujeres4,
        pmujeres5 = @pmujeres5,
        pmujeres6 = @pmujeres6,
        pmujeres7 = @pmujeres7,
        pmujeres8 = @pmujeres8,
        phombres1 = @phombres1,
        phombres2 = @phombres2,
        phombres3 = @phombres3,
        phombres4 = @phombres4,
        phombres5 = @phombres5,
        phombres6 = @phombres6,
        phombres7 = @phombres7,
        phombres8 = @phombres8,
        nombre_archivo = @nombre_archivo,
        nombre_archivo2 = @nombre_archivo2,
        nombre_archivo3 = @nombre_archivo3,
        status = 3
    WHERE idcurso = @idcurso
  `)
}

export const eliminarActividad = async (idcurso) => {
  const pool = await getPool()
  const request = pool.request()

  request.input('idcurso', sql.Int, idcurso)

  await request.query(`
    UPDATE sisecycc2024.dbo.sisec_talleres_intervenciones
    SET status = 0
    WHERE idcurso = @idcurso
  `)
}

export const getDashboardMetrics = async (idsede, filtros = {}) => {
  try {
    const newPool = await getNewPool()
    const checkTable = await newPool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'acciones_educativas'
    `)

    if (checkTable.recordset.length > 0) {
      const request = newPool.request()
      const sedeNum = Number(idsede) || 1
      request.input('idsede', sql.Int, sedeNum)

      let dateFilter = ''
      let dateFilterEnc = ''
      if (filtros.anio) {
        request.input('anio', sql.Int, Number(filtros.anio))
        dateFilter += ' AND YEAR(ae.fecha_programada) = @anio'
        dateFilterEnc += ' AND YEAR(ae2.fecha_programada) = @anio'
      }
      if (filtros.mes) {
        request.input('mes', sql.Int, Number(filtros.mes))
        dateFilter += ' AND MONTH(ae.fecha_programada) = @mes'
        dateFilterEnc += ' AND MONTH(ae2.fecha_programada) = @mes'
      }

      const result = await request.query(`
        SELECT
          COUNT(*) AS total_acciones,
          ISNULL(SUM(CASE WHEN ae.id_estado = 1 THEN 1 ELSE 0 END), 0) AS sin_capturar,
          ISNULL(SUM(CASE WHEN ae.id_estado = 2 THEN 1 ELSE 0 END), 0) AS capturadas,
          ISNULL(SUM(CASE WHEN ae.id_estado = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
          ISNULL(SUM(CASE WHEN ae.id_estado IN (2, 3) THEN 1 ELSE 0 END), 0) AS total_capturadas,
          ISNULL(SUM(CASE WHEN ae.id_estado = 4 THEN 1 ELSE 0 END), 0) AS canceladas,
          (SELECT COUNT(*) FROM encuestas enc 
           INNER JOIN acciones_educativas ae2 ON enc.id_acciones_educativas = ae2.id_acciones_educativas 
           INNER JOIN usuarios u2 ON ae2.id_usuario = u2.id_usuario 
           WHERE u2.id_distrito = @idsede ${dateFilterEnc}) AS total_encuestas
        FROM acciones_educativas ae
        INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
        WHERE u.id_distrito = @idsede ${dateFilter}
      `)

      const row = result.recordset[0] || {}
      const total_acciones = Number(row.total_acciones || 0)
      const sin_capturar = Number(row.sin_capturar || 0)
      const capturadas = Number(row.capturadas || 0)
      const finalizadas = Number(row.finalizadas || 0)
      const total_capturadas = Number(row.total_capturadas || 0)
      const total_encuestas = Number(row.total_encuestas || 0)

      return {
        total_acciones,
        sin_capturar,
        capturadas,
        finalizadas,
        total_capturadas,
        total_encuestas,
        actividades_realizadas: total_capturadas,
        actividades_pendientes: sin_capturar
      }
    }
  } catch (err) {
    // Si falla o no existe tabla nueva, continúa con fallback legacy
  }

  // Fallback con BD legacy
  try {
    const pool = await getPool()
    const request = pool.request()
    request.input('idsede', sql.TinyInt, Number(idsede) || 1)

    const result = await request.query(`
      SELECT
        COUNT(*) AS total_acciones,
        ISNULL(SUM(CASE WHEN ti.status = 3 THEN 1 ELSE 0 END), 0) AS actividades_realizadas,
        ISNULL(SUM(CASE WHEN ti.status = 1 THEN 1 ELSE 0 END), 0) AS actividades_pendientes,
        ISNULL(SUM(CASE WHEN ti.status = 2 THEN 1 ELSE 0 END), 0) AS canceladas,
        (SELECT COUNT(*) FROM sisecycc2024.dbo.sisec_encuestas) AS total_encuestas
      FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
      INNER JOIN sisec_usuarios u ON ti.idusuario = u.idusuario
      WHERE u.idsede = @idsede
    `)

    const r = result.recordset[0] || {}
    const realizadas = Number(r.actividades_realizadas || 0)
    const pendientes = Number(r.actividades_pendientes || 0)
    const total = Number(r.total_acciones || (realizadas + pendientes))

    return {
      total_acciones: total,
      sin_capturar: pendientes,
      capturadas: realizadas,
      finalizadas: realizadas,
      total_capturadas: realizadas,
      total_encuestas: Number(r.total_encuestas || 0),
      actividades_realizadas: realizadas,
      actividades_pendientes: pendientes
    }
  } catch (e) {
    return {
      total_acciones: 0,
      sin_capturar: 0,
      capturadas: 0,
      finalizadas: 0,
      total_capturadas: 0,
      total_encuestas: 0,
      actividades_realizadas: 0,
      actividades_pendientes: 0
    }
  }
}

export const getAdminDashboardMetrics = async (filtros = {}) => {
  try {
    const newPool = await getNewPool()
    const checkTable = await newPool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'acciones_educativas'
    `)

    if (checkTable.recordset.length > 0) {
      const anio = filtros.anio ? Number(filtros.anio) : null
      const mes = filtros.mes ? Number(filtros.mes) : null

      const reqGlobal = newPool.request()
      const reqDistritos = newPool.request()

      let dateFilterGlobal = 'WHERE 1=1'
      let dateFilterDistritos = 'WHERE 1=1'
      let dateFilterEncGlobal = ''
      let dateFilterEncDist = ''

      if (anio) {
        reqGlobal.input('anio', sql.Int, anio)
        reqDistritos.input('anio', sql.Int, anio)
        dateFilterGlobal += ' AND YEAR(ae.fecha_programada) = @anio'
        dateFilterDistritos += ' AND YEAR(ae.fecha_programada) = @anio'
        dateFilterEncGlobal += ' AND YEAR(ae_enc.fecha_programada) = @anio'
        dateFilterEncDist += ' AND YEAR(ae2.fecha_programada) = @anio'
      }
      if (mes) {
        reqGlobal.input('mes', sql.Int, mes)
        reqDistritos.input('mes', sql.Int, mes)
        dateFilterGlobal += ' AND MONTH(ae.fecha_programada) = @mes'
        dateFilterDistritos += ' AND MONTH(ae.fecha_programada) = @mes'
        dateFilterEncGlobal += ' AND MONTH(ae_enc.fecha_programada) = @mes'
        dateFilterEncDist += ' AND MONTH(ae2.fecha_programada) = @mes'
      }

      // Años disponibles en base de datos
      const aniosQuery = await newPool.request().query(`
        SELECT DISTINCT YEAR(fecha_programada) AS anio
        FROM acciones_educativas
        WHERE fecha_programada IS NOT NULL
        ORDER BY anio DESC
      `)
      const aniosDisponibles = aniosQuery.recordset.map(r => r.anio)
      if (!aniosDisponibles.includes(2027)) aniosDisponibles.unshift(2027)

      // 1. Métricas Globales 2027
      const globalQuery = await reqGlobal.query(`
        SELECT
          COUNT(*) AS total_acciones,
          ISNULL(SUM(CASE WHEN ae.id_estado = 1 THEN 1 ELSE 0 END), 0) AS sin_capturar,
          ISNULL(SUM(CASE WHEN ae.id_estado = 2 THEN 1 ELSE 0 END), 0) AS capturadas,
          ISNULL(SUM(CASE WHEN ae.id_estado = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
          ISNULL(SUM(CASE WHEN ae.id_estado IN (2, 3) THEN 1 ELSE 0 END), 0) AS total_capturadas,
          ISNULL(SUM(CASE WHEN ae.id_estado = 4 THEN 1 ELSE 0 END), 0) AS canceladas,
          (SELECT COUNT(*) FROM encuestas enc INNER JOIN acciones_educativas ae_enc ON enc.id_acciones_educativas = ae_enc.id_acciones_educativas WHERE 1=1 ${dateFilterEncGlobal}) AS total_encuestas,
          (SELECT COUNT(DISTINCT enc.id_acciones_educativas) FROM encuestas enc INNER JOIN acciones_educativas ae_enc ON enc.id_acciones_educativas = ae_enc.id_acciones_educativas WHERE 1=1 ${dateFilterEncGlobal}) AS acciones_con_encuestas
        FROM acciones_educativas ae
        ${dateFilterGlobal}
      `)

      // 2. Gráfica por Distrito (Distritos 1 a 33 y Central)
      const distritosQuery = await reqDistritos.query(`
        SELECT
          u.id_distrito AS idsede,
          COUNT(*) AS total_acciones,
          ISNULL(SUM(CASE WHEN ae.id_estado = 1 THEN 1 ELSE 0 END), 0) AS sin_capturar,
          ISNULL(SUM(CASE WHEN ae.id_estado = 2 THEN 1 ELSE 0 END), 0) AS capturadas,
          ISNULL(SUM(CASE WHEN ae.id_estado = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
          ISNULL(SUM(CASE WHEN ae.id_estado IN (2, 3) THEN 1 ELSE 0 END), 0) AS total_actividades,
          ISNULL(SUM(CASE WHEN ae.id_estado = 4 THEN 1 ELSE 0 END), 0) AS canceladas,
          (SELECT COUNT(*) FROM encuestas enc 
           INNER JOIN acciones_educativas ae2 ON enc.id_acciones_educativas = ae2.id_acciones_educativas 
           INNER JOIN usuarios u2 ON ae2.id_usuario = u2.id_usuario 
           WHERE u2.id_distrito = u.id_distrito ${dateFilterEncDist}) AS total_encuestas,
          (SELECT COUNT(DISTINCT enc.id_acciones_educativas) FROM encuestas enc 
           INNER JOIN acciones_educativas ae2 ON enc.id_acciones_educativas = ae2.id_acciones_educativas 
           INNER JOIN usuarios u2 ON ae2.id_usuario = u2.id_usuario 
           WHERE u2.id_distrito = u.id_distrito ${dateFilterEncDist}) AS acciones_con_encuestas
        FROM acciones_educativas ae
        INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
        ${dateFilterDistritos}
        GROUP BY u.id_distrito
        ORDER BY u.id_distrito ASC
      `)

      // Armar mapa para los 33 distritos completos
      const distritosMap = {}
      for (let i = 1; i <= 33; i++) {
        distritosMap[i] = {
          idsede: i,
          distrito: `Distrito ${i}`,
          total_acciones: 0,
          sin_capturar: 0,
          capturadas: 0,
          finalizadas: 0,
          total_actividades: 0,
          con_folio: 0,
          canceladas: 0,
          total_encuestas: 0,
          acciones_con_encuestas: 0,
          porcentaje_avance: 0
        }
      }

      for (const d of distritosQuery.recordset) {
        const sedeNum = Number(d.idsede)
        const tot = Number(d.total_acciones || 0)
        const act = Number(d.total_actividades || 0)
        const pct = tot > 0 ? Math.round((act / tot) * 100) : 0

        const itemData = {
          idsede: sedeNum,
          distrito: sedeNum === 0 ? 'Central' : `Distrito ${sedeNum}`,
          total_acciones: tot,
          sin_capturar: Number(d.sin_capturar || 0),
          capturadas: Number(d.capturadas || 0),
          finalizadas: Number(d.finalizadas || 0),
          total_actividades: act,
          con_folio: act,
          canceladas: Number(d.canceladas || 0),
          total_encuestas: Number(d.total_encuestas || 0),
          acciones_con_encuestas: Number(d.acciones_con_encuestas || 0),
          porcentaje_avance: pct
        }

        if (sedeNum >= 1 && sedeNum <= 33) {
          distritosMap[sedeNum] = itemData
        } else if (sedeNum === 0) {
          distritosMap[0] = itemData
        }
      }

      const distritosArray = Object.values(distritosMap).sort((a, b) => a.idsede - b.idsede)
      const gm = globalQuery.recordset[0] || {}
      const total_acciones = Number(gm.total_acciones || 0)
      const sin_capturar = Number(gm.sin_capturar || 0)
      const capturadas = Number(gm.capturadas || 0)
      const finalizadas = Number(gm.finalizadas || 0)
      const total_capturadas = Number(gm.total_capturadas || 0)
      const total_encuestas = Number(gm.total_encuestas || 0)

      return {
        total_acciones,
        sin_capturar,
        capturadas,
        finalizadas,
        total_capturadas,
        total_encuestas,
        acciones_con_encuestas: Number(gm.acciones_con_encuestas || 0),
        con_folio: total_capturadas,
        actividades_realizadas: total_capturadas,
        actividades_pendientes: sin_capturar,
        grafica_distritos: distritosArray,
        anios_disponibles: aniosDisponibles
      }
    }
  } catch (err) {
    logger.error(`[METRICAS ADMIN] Error consultando métricas 2027: ${err.message}`)
    // Si falla o no existe tabla nueva, continúa con fallback legacy
  }

  // Fallback con BD legacy
  try {
    const pool = await getPool()
    const globalQuery = await pool.request().query(`
      SELECT
        COUNT(*) AS total_acciones,
        ISNULL(SUM(CASE WHEN ti.status = 3 THEN 1 ELSE 0 END), 0) AS actividades_realizadas,
        ISNULL(SUM(CASE WHEN ti.status = 1 THEN 1 ELSE 0 END), 0) AS actividades_pendientes,
        (SELECT COUNT(*) FROM sisecycc2024.dbo.sisec_encuestas) AS total_encuestas
      FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
      WHERE ti.status IN (1, 2, 3)
    `)

    const distritosQuery = await pool.request().query(`
      SELECT
        u.idsede,
        COUNT(*) as total_acciones,
        SUM(CASE WHEN ti.status = 3 THEN 1 ELSE 0 END) as total_actividades,
        SUM(CASE WHEN ti.status = 1 THEN 1 ELSE 0 END) as sin_capturar,
        (SELECT COUNT(*) FROM sisecycc2024.dbo.sisec_encuestas e INNER JOIN sisec_usuarios ue ON e.idusuario = ue.idusuario WHERE ue.idsede = u.idsede) as total_encuestas
      FROM sisec_usuarios u
      LEFT JOIN sisecycc2024.dbo.sisec_talleres_intervenciones ti 
        ON u.idusuario = ti.idusuario
      WHERE u.idsede BETWEEN 1 AND 33
      GROUP BY u.idsede
      ORDER BY u.idsede ASC
    `)

    const distritosMap = {}
    for (let i = 1; i <= 33; i++) {
      distritosMap[i] = {
        idsede: i,
        distrito: `Distrito ${i}`,
        total_acciones: 0,
        sin_capturar: 0,
        capturadas: 0,
        finalizadas: 0,
        total_actividades: 0,
        canceladas: 0,
        total_encuestas: 0,
        porcentaje_avance: 0
      }
    }

    for (const d of (distritosQuery.recordset || [])) {
      const s = Number(d.idsede)
      if (s >= 1 && s <= 33) {
        const tot = Number(d.total_acciones || 0)
        const act = Number(d.total_actividades || 0)
        distritosMap[s] = {
          idsede: s,
          distrito: `Distrito ${s}`,
          total_acciones: tot,
          sin_capturar: Number(d.sin_capturar || 0),
          capturadas: act,
          finalizadas: act,
          total_actividades: act,
          canceladas: 0,
          total_encuestas: Number(d.total_encuestas || 0),
          porcentaje_avance: tot > 0 ? Math.round((act / tot) * 100) : 0
        }
      }
    }

    const gm = globalQuery.recordset[0] || {}
    const actRealizadas = Number(gm.actividades_realizadas || 0)
    const actPendientes = Number(gm.actividades_pendientes || 0)
    const totAcciones = Number(gm.total_acciones || (actRealizadas + actPendientes))

    return {
      total_acciones: totAcciones,
      sin_capturar: actPendientes,
      capturadas: actRealizadas,
      finalizadas: actRealizadas,
      total_capturadas: actRealizadas,
      total_encuestas: Number(gm.total_encuestas || 0),
      actividades_realizadas: actRealizadas,
      actividades_pendientes: actPendientes,
      grafica_distritos: Object.values(distritosMap).sort((a, b) => a.idsede - b.idsede)
    }
  } catch (e) {
    const emptyDistritos = []
    for (let i = 1; i <= 33; i++) {
      emptyDistritos.push({
        idsede: i,
        distrito: `Distrito ${i}`,
        total_acciones: 0,
        sin_capturar: 0,
        capturadas: 0,
        finalizadas: 0,
        total_actividades: 0,
        canceladas: 0,
        total_encuestas: 0,
        porcentaje_avance: 0
      })
    }
    return {
      total_acciones: 0,
      sin_capturar: 0,
      capturadas: 0,
      finalizadas: 0,
      total_capturadas: 0,
      total_encuestas: 0,
      actividades_realizadas: 0,
      actividades_pendientes: 0,
      grafica_distritos: emptyDistritos
    }
  }
}
