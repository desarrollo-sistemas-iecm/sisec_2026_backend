// Modelo de Metas Anuales y Recordatorios 2027
import { getNewPool, getPool, sql } from '../config/db.js'
import { logger } from '../config/logger.js'

export const listMetas = async (anio = 2027) => {
  const pool = await getNewPool()

  // 1. Obtener conteo real de acciones finalizadas y capturadas
  let totalFinalizadasGlobal = 0
  let distritosFinalizadasMap = {}
  let anioEfectivo = anio

  try {
    // Si el año solicitado no tiene registros, buscar el año con datos disponibles en acciones_educativas
    const countCheck = await pool.request()
      .input('anio', sql.Int, anio)
      .query(`SELECT COUNT(*) AS total FROM acciones_educativas WHERE YEAR(fecha_programada) = @anio`)
    
    if (Number(countCheck.recordset[0]?.total || 0) === 0) {
      const topYearRes = await pool.request().query(`
        SELECT TOP 1 YEAR(fecha_programada) AS y_act 
        FROM acciones_educativas 
        WHERE fecha_programada IS NOT NULL 
        ORDER BY fecha_programada DESC
      `)
      if (topYearRes.recordset.length > 0 && topYearRes.recordset[0].y_act) {
        anioEfectivo = Number(topYearRes.recordset[0].y_act)
      }
    }

    const statsQuery = await pool.request()
      .input('anio', sql.Int, anioEfectivo)
      .query(`
        SELECT 
          u.id_distrito,
          ISNULL(SUM(CASE WHEN ae.id_estado = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
          ISNULL(SUM(CASE WHEN ae.id_estado = 2 THEN 1 ELSE 0 END), 0) AS capturadas
        FROM acciones_educativas ae
        INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
        WHERE YEAR(ae.fecha_programada) = @anio
        GROUP BY u.id_distrito
      `)

    for (const r of statsQuery.recordset) {
      const d = Number(r.id_distrito)
      const fin = Number(r.finalizadas || 0)
      totalFinalizadasGlobal += fin
      distritosFinalizadasMap[d] = fin
    }

    if (totalFinalizadasGlobal === 0) {
      // Fallback a BD legacy
      try {
        const legPool = await getPool()
        const legStats = await legPool.request().query(`
          SELECT
            u.idsede AS id_distrito,
            ISNULL(SUM(CASE WHEN ti.status = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
            ISNULL(SUM(CASE WHEN ti.status = 2 THEN 1 ELSE 0 END), 0) AS capturadas
          FROM sisec_usuarios u
          LEFT JOIN sisecycc2024.dbo.sisec_talleres_intervenciones ti ON u.idusuario = ti.idusuario
          WHERE u.idsede BETWEEN 1 AND 33
          GROUP BY u.idsede
        `)
        for (const r of (legStats.recordset || [])) {
          const d = Number(r.id_distrito)
          const fin = Number(r.finalizadas || 0)
          totalFinalizadasGlobal += fin
          distritosFinalizadasMap[d] = fin
        }
      } catch (legErr) {}
    }
  } catch (err) {
    logger.warn(`[METAS] Advertencia al calcular finalizadas para metas: ${err.message}`)
  }

  // 2. Consultar tabla config_metas_anuales
  try {
    const checkTable = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'config_metas_anuales'
    `)

    if (checkTable.recordset.length > 0) {
      const result = await pool.request()
        .input('anio', sql.Int, anio)
        .query(`
          SELECT 
            id_meta,
            anio,
            id_distrito,
            meta_anual,
            descripcion,
            activo,
            fecha_creacion,
            fecha_actualizacion
          FROM config_metas_anuales
          WHERE anio = @anio AND activo = 1
          ORDER BY id_distrito ASC
        `)

      if (result.recordset.length > 0) {
        return result.recordset.map(row => {
          const d = Number(row.id_distrito)
          const finalizadas = d === 0 ? totalFinalizadasGlobal : (distritosFinalizadasMap[d] || 0)
          const meta = Number(row.meta_anual || 4500)
          const porcentaje = meta > 0 ? Number(((finalizadas / meta) * 100).toFixed(2)) : 0

          return {
            ...row,
            id_distrito: d,
            distrito_nombre: d === 0 ? 'Todos los distritos (Global)' : (d === 0 ? 'Oficinas Centrales' : `Dirección Distrital ${d}`),
            total_finalizadas: finalizadas,
            porcentaje_avance: porcentaje
          }
        })
      }
    }
  } catch (err) {
    logger.warn(`[METAS] Error al consultar config_metas_anuales: ${err.message}`)
  }

  // 3. Fallback inicial si la tabla no se ha creado aún en BD
  const metaDefault = 4500
  const pctDefault = Number(((totalFinalizadasGlobal / metaDefault) * 100).toFixed(2))
  return [
    {
      id_meta: 1,
      anio: anio,
      id_distrito: 0,
      distrito_nombre: 'Todos los distritos (Global)',
      meta_anual: metaDefault,
      descripcion: 'Meta Institucional Anual 2027 para los 33 Órganos Distritales',
      activo: 1,
      total_finalizadas: totalFinalizadasGlobal,
      porcentaje_avance: pctDefault,
      fecha_creacion: new Date()
    }
  ]
}

export const upsertMeta = async (payload, id_usuario = 1) => {
  const pool = await getNewPool()
  const request = pool.request()

  const anio = Number(payload.anio || 2027)
  const id_distrito = Number(payload.id_distrito || 0)
  const meta_anual = Number(payload.meta_anual)
  const descripcion = String(payload.descripcion || '').trim()

  if (!meta_anual || isNaN(meta_anual) || meta_anual < 1 || meta_anual > 99999) {
    throw new Error('La meta debe ser un número entero válido (de hasta 5 dígitos).')
  }

  request.input('anio', sql.Int, anio)
  request.input('id_distrito', sql.Int, id_distrito)
  request.input('meta_anual', sql.Int, meta_anual)
  request.input('descripcion', sql.VarChar(255), descripcion)
  request.input('id_usuario', sql.Int, id_usuario)

  // Verificar si ya existe registro para ese año y distrito
  const existing = await request.query(`
    SELECT id_meta FROM config_metas_anuales WHERE anio = @anio AND id_distrito = @id_distrito
  `)

  if (existing.recordset.length > 0) {
    const id_meta = existing.recordset[0].id_meta
    const updateReq = pool.request()
    updateReq.input('id_meta', sql.Int, id_meta)
    updateReq.input('meta_anual', sql.Int, meta_anual)
    updateReq.input('descripcion', sql.VarChar(255), descripcion)
    updateReq.input('id_usuario', sql.Int, id_usuario)

    await updateReq.query(`
      UPDATE config_metas_anuales
      SET meta_anual = @meta_anual,
          descripcion = @descripcion,
          activo = 1,
          fecha_actualizacion = GETDATE(),
          id_usuario_creacion = @id_usuario
      WHERE id_meta = @id_meta
    `)
    return { id_meta, action: 'updated' }
  } else {
    const insertReq = pool.request()
    insertReq.input('anio', sql.Int, anio)
    insertReq.input('id_distrito', sql.Int, id_distrito)
    insertReq.input('meta_anual', sql.Int, meta_anual)
    insertReq.input('descripcion', sql.VarChar(255), descripcion)
    insertReq.input('id_usuario', sql.Int, id_usuario)

    const insertResult = await insertReq.query(`
      INSERT INTO config_metas_anuales (anio, id_distrito, meta_anual, descripcion, activo, fecha_creacion, id_usuario_creacion)
      OUTPUT INSERTED.id_meta
      VALUES (@anio, @id_distrito, @meta_anual, @descripcion, 1, GETDATE(), @id_usuario)
    `)
    return { id_meta: insertResult.recordset[0]?.id_meta, action: 'created' }
  }
}

export const updateMetaAmount = async (id_meta, meta_anual, descripcion, id_usuario = 1) => {
  const pool = await getNewPool()
  const metaNum = Number(meta_anual)

  if (!metaNum || isNaN(metaNum) || metaNum < 1 || metaNum > 99999) {
    throw new Error('La meta debe ser un número entero válido (de hasta 5 dígitos).')
  }

  const req = pool.request()
  req.input('id_meta', sql.Int, id_meta)
  req.input('meta_anual', sql.Int, metaNum)
  req.input('descripcion', sql.VarChar(255), String(descripcion || '').trim())
  req.input('id_usuario', sql.Int, id_usuario)

  await req.query(`
    UPDATE config_metas_anuales
    SET meta_anual = @meta_anual,
        descripcion = @descripcion,
        fecha_actualizacion = GETDATE(),
        id_usuario_creacion = @id_usuario
    WHERE id_meta = @id_meta
  `)

  return true
}

export const listRecordatorios = async () => {
  const pool = await getNewPool()
  try {
    const checkTable = await pool.request().query(`
      SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'config_recordatorios_metas'
    `)

    if (checkTable.recordset.length > 0) {
      const result = await pool.request().query(`
        SELECT 
          id_recordatorio,
          titulo,
          mensaje,
          frecuencia,
          dia_disparo,
          hora_disparo,
          id_distrito_destino,
          activo,
          ultimo_disparo,
          total_disparos,
          fecha_creacion,
          fecha_actualizacion
        FROM config_recordatorios_metas
        ORDER BY id_recordatorio DESC
      `)
      return result.recordset
    }
  } catch (err) {
    logger.warn(`[METAS] Error consultando recordatorios: ${err.message}`)
  }

  // Fallback inicial
  return [
    {
      id_recordatorio: 1,
      titulo: 'Recordatorio mensual de cumplimiento de meta institucional',
      mensaje: 'Estimadas Direcciones Distritales: Se les recuerda verificar sus acciones educativas programadas y concluir la captura de evidencias y encuestas de satisfacción para avanzar en el cumplimiento de la meta anual.',
      frecuencia: 'mensual',
      dia_disparo: 1,
      hora_disparo: '09:00',
      id_distrito_destino: 0,
      activo: 1,
      ultimo_disparo: null,
      total_disparos: 0,
      fecha_creacion: new Date()
    }
  ]
}

export const upsertRecordatorio = async (payload, id_usuario = 1) => {
  const pool = await getNewPool()
  const req = pool.request()

  const id_recordatorio = payload.id_recordatorio ? Number(payload.id_recordatorio) : null
  const titulo = String(payload.titulo || 'Recordatorio de Cumplimiento de Meta Anual').trim()
  const mensaje = String(payload.mensaje || '').trim()
  const frecuencia = String(payload.frecuencia || 'mensual').trim()
  const dia_disparo = Number(payload.dia_disparo || 1)
  const hora_disparo = String(payload.hora_disparo || '09:00').trim()
  const id_distrito_destino = Number(payload.id_distrito_destino || 0)
  const activo = payload.activo !== undefined ? (payload.activo ? 1 : 0) : 1

  if (!mensaje) {
    throw new Error('El contenido del mensaje del recordatorio es obligatorio.')
  }

  req.input('titulo', sql.VarChar(150), titulo)
  req.input('mensaje', sql.VarChar(sql.MAX), mensaje)
  req.input('frecuencia', sql.VarChar(50), frecuencia)
  req.input('dia_disparo', sql.Int, dia_disparo)
  req.input('hora_disparo', sql.VarChar(5), hora_disparo)
  req.input('id_distrito_destino', sql.Int, id_distrito_destino)
  req.input('activo', sql.Bit, activo)
  req.input('id_usuario', sql.Int, id_usuario)

  if (id_recordatorio) {
    req.input('id_recordatorio', sql.Int, id_recordatorio)
    await req.query(`
      UPDATE config_recordatorios_metas
      SET titulo = @titulo,
          mensaje = @mensaje,
          frecuencia = @frecuencia,
          dia_disparo = @dia_disparo,
          hora_disparo = @hora_disparo,
          id_distrito_destino = @id_distrito_destino,
          activo = @activo,
          fecha_actualizacion = GETDATE(),
          id_usuario_creacion = @id_usuario
      WHERE id_recordatorio = @id_recordatorio
    `)
    return { id_recordatorio, action: 'updated' }
  } else {
    const result = await req.query(`
      INSERT INTO config_recordatorios_metas (
        titulo, mensaje, frecuencia, dia_disparo, hora_disparo,
        id_distrito_destino, activo, total_disparos, fecha_creacion, id_usuario_creacion
      )
      OUTPUT INSERTED.id_recordatorio
      VALUES (
        @titulo, @mensaje, @frecuencia, @dia_disparo, @hora_disparo,
        @id_distrito_destino, @activo, 0, GETDATE(), @id_usuario
      )
    `)
    return { id_recordatorio: result.recordset[0]?.id_recordatorio, action: 'created' }
  }
}

export const dispararRecordatorio = async (id_recordatorio, id_usuario_origen = 1) => {
  const pool = await getNewPool()
  const recReq = pool.request()
  recReq.input('id', sql.Int, id_recordatorio)

  const recResult = await recReq.query(`
    SELECT * FROM config_recordatorios_metas WHERE id_recordatorio = @id
  `)

  if (recResult.recordset.length === 0) {
    throw new Error('Recordatorio no encontrado.')
  }

  const rec = recResult.recordset[0]
  const idDistritoDestino = Number(rec.id_distrito_destino || 0)

  // 1. Insertar notificación institucional en mensajes_notificaciones
  let notificacionesInsertadas = 0
  try {
    const notifReq = pool.request()
    notifReq.input('id_usuario_origen', sql.Int, id_usuario_origen)
    notifReq.input('titulo', sql.VarChar(120), rec.titulo.slice(0, 120))
    notifReq.input('mensaje_base', sql.VarChar(300), rec.mensaje.slice(0, 300))

    if (idDistritoDestino === 0) {
      // Disparar a los 33 distritos
      for (let d = 1; d <= 33; d++) {
        const dReq = pool.request()
        dReq.input('id_usuario_origen', sql.Int, id_usuario_origen)
        dReq.input('id_distrito_destino', sql.Int, d)
        dReq.input('titulo', sql.VarChar(120), rec.titulo.slice(0, 120))
        dReq.input('mensaje_base', sql.VarChar(300), rec.mensaje.slice(0, 300))
        await dReq.query(`
          INSERT INTO mensajes_notificaciones (
            id_usuario_origen, id_distrito_origen, id_tipousuario_destino,
            titulo, mensaje_base, estado_solicitud, leido, status, fecha_envio
          ) VALUES (
            @id_usuario_origen, 0, 1,
            @titulo, @mensaje_base, 'PENDIENTE', 0, 1, GETDATE()
          )
        `)
        notificacionesInsertadas++
      }
    } else {
      // Disparar a distrito específico
      const dReq = pool.request()
      dReq.input('id_usuario_origen', sql.Int, id_usuario_origen)
      dReq.input('id_distrito_destino', sql.Int, idDistritoDestino)
      dReq.input('titulo', sql.VarChar(120), rec.titulo.slice(0, 120))
      dReq.input('mensaje_base', sql.VarChar(300), rec.mensaje.slice(0, 300))
      await dReq.query(`
        INSERT INTO mensajes_notificaciones (
          id_usuario_origen, id_distrito_origen, id_tipousuario_destino,
          titulo, mensaje_base, estado_solicitud, leido, status, fecha_envio
        ) VALUES (
          @id_usuario_origen, 0, 1,
          @titulo, @mensaje_base, 'PENDIENTE', 0, 1, GETDATE()
        )
      `)
      notificacionesInsertadas = 1
    }
  } catch (err) {
    logger.error(`[METAS] Error al insertar notificaciones de recordatorio: ${err.message}`)
  }

  // 2. Actualizar registro de disparo
  try {
    const updReq = pool.request()
    updReq.input('id', sql.Int, id_recordatorio)
    await updReq.query(`
      UPDATE config_recordatorios_metas
      SET ultimo_disparo = GETDATE(),
          total_disparos = total_disparos + 1
      WHERE id_recordatorio = @id
    `)
  } catch (err) {}

  return {
    success: true,
    notificaciones_enviadas: notificacionesInsertadas,
    titulo: rec.titulo,
    mensaje: rec.mensaje,
    id_distrito_destino: idDistritoDestino
  }
}

export const getMetasDashboardStats = async (filtros = {}) => {
  const pool = await getNewPool()
  let anio = filtros.anio ? Number(filtros.anio) : null
  const id_distrito = filtros.id_distrito !== undefined && filtros.id_distrito !== '' ? Number(filtros.id_distrito) : null

  // Si no se especificó año o el año 2027 aún no tiene registros, detectar el año con datos activos en BD
  try {
    if (anio) {
      const chk = await pool.request().input('y', sql.Int, anio).query(`
        SELECT COUNT(*) as c FROM acciones_educativas WHERE YEAR(fecha_programada) = @y
      `)
      if (Number(chk.recordset[0]?.c || 0) === 0) {
        const topYear = await pool.request().query(`
          SELECT TOP 1 YEAR(fecha_programada) as y_act FROM acciones_educativas WHERE fecha_programada IS NOT NULL ORDER BY fecha_programada DESC
        `)
        if (topYear.recordset.length > 0 && topYear.recordset[0].y_act) {
          anio = Number(topYear.recordset[0].y_act)
        }
      }
    } else {
      const topYear = await pool.request().query(`
        SELECT TOP 1 YEAR(fecha_programada) as y_act FROM acciones_educativas WHERE fecha_programada IS NOT NULL ORDER BY fecha_programada DESC
      `)
      if (topYear.recordset.length > 0 && topYear.recordset[0].y_act) {
        anio = Number(topYear.recordset[0].y_act)
      } else {
        anio = 2027
      }
    }
  } catch (e) {
    if (!anio) anio = 2027
  }

  // 1. Obtener meta activa
  let metaActual = 4500
  try {
    const metaReq = pool.request()
    metaReq.input('anio', sql.Int, anio)

    let metaQuery = `SELECT meta_anual FROM config_metas_anuales WHERE (anio = @anio OR anio = 2027) AND activo = 1`
    if (id_distrito !== null && id_distrito > 0) {
      metaReq.input('distrito', sql.Int, id_distrito)
      metaQuery += ` AND id_distrito = @distrito`
    } else {
      metaQuery += ` AND id_distrito = 0`
    }
    metaQuery += ` ORDER BY anio DESC`

    const metaRes = await metaReq.query(metaQuery)
    if (metaRes.recordset.length > 0) {
      metaActual = Number(metaRes.recordset[0].meta_anual || 4500)
    } else if (id_distrito > 0) {
      // Fallback a meta global si el distrito aún no cuenta con una meta específica
      const globRes = await pool.request()
        .input('anio', sql.Int, anio)
        .query(`SELECT meta_anual FROM config_metas_anuales WHERE (anio = @anio OR anio = 2027) AND activo = 1 AND id_distrito = 0 ORDER BY anio DESC`)
      if (globRes.recordset.length > 0) {
        metaActual = Number(globRes.recordset[0].meta_anual || 4500)
      }
    }
  } catch (err) {
    logger.warn(`[METAS] Advertencia leyendo meta para dashboard: ${err.message}`)
  }

  // 2. Métricas de Acciones (Totales, Sin Capturar, Capturadas, Finalizadas)
  let totalAcciones = 0
  let finalizadas = 0
  let capturadas = 0
  let sinCapturar = 0

  const actReq = pool.request()
  actReq.input('anio', sql.Int, anio)
  let actQuery = `
    SELECT
      COUNT(*) AS total,
      ISNULL(SUM(CASE WHEN ae.id_estado = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
      ISNULL(SUM(CASE WHEN ae.id_estado = 2 THEN 1 ELSE 0 END), 0) AS capturadas,
      ISNULL(SUM(CASE WHEN ae.id_estado = 1 THEN 1 ELSE 0 END), 0) AS sin_capturar
    FROM acciones_educativas ae
    INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
    WHERE YEAR(ae.fecha_programada) = @anio
  `
  if (id_distrito !== null && id_distrito > 0) {
    actReq.input('distrito', sql.Int, id_distrito)
    actQuery += ` AND u.id_distrito = @distrito`
  }

  try {
    const actRes = await actReq.query(actQuery)
    if (actRes.recordset.length > 0 && Number(actRes.recordset[0].total || 0) > 0) {
      const row = actRes.recordset[0]
      totalAcciones = Number(row.total || 0)
      finalizadas = Number(row.finalizadas || 0)
      capturadas = Number(row.capturadas || 0)
      sinCapturar = Number(row.sin_capturar || 0)
    } else {
      // Fallback a BD legacy para visualización inmediata si 2027 aún no tiene registros
      try {
        const legPool = await getPool()
        const legReq = legPool.request()
        let legQuery = `
          SELECT
            COUNT(*) AS total,
            ISNULL(SUM(CASE WHEN ti.status = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
            ISNULL(SUM(CASE WHEN ti.status = 2 THEN 1 ELSE 0 END), 0) AS capturadas,
            ISNULL(SUM(CASE WHEN ti.status = 1 THEN 1 ELSE 0 END), 0) AS sin_capturar
          FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
          LEFT JOIN sisec_usuarios u ON ti.idusuario = u.idusuario
          WHERE ti.status IN (1, 2, 3)
        `
        if (id_distrito !== null && id_distrito > 0) {
          legReq.input('sede', sql.TinyInt, id_distrito)
          legQuery += ` AND u.idsede = @sede`
        }
        const legRes = await legReq.query(legQuery)
        if (legRes.recordset.length > 0 && Number(legRes.recordset[0].total || 0) > 0) {
          const row = legRes.recordset[0]
          totalAcciones = Number(row.total || 0)
          finalizadas = Number(row.finalizadas || 0)
          capturadas = Number(row.capturadas || 0)
          sinCapturar = Number(row.sin_capturar || 0)
        }
      } catch (legErr) {
        logger.warn(`[METAS] Error fallback en legQuery: ${legErr.message}`)
      }
    }
  } catch (err) {
    logger.warn(`[METAS] Advertencia leyendo acciones: ${err.message}`)
  }

  // 3. Desglose Mensual (Ene a Dic) para Bar Chart 4
  const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const mesesCompletos = mesesNombres.map((nom, idx) => ({
    mes: idx + 1,
    nombre: nom,
    programadas: 0,
    finalizadas: 0,
    en_proceso: 0
  }))

  try {
    const mesReq = pool.request()
    mesReq.input('anio', sql.Int, anio)
    let mesQuery = `
      SELECT 
        MONTH(ae.fecha_programada) AS mes,
        COUNT(*) AS programadas,
        ISNULL(SUM(CASE WHEN ae.id_estado = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
        ISNULL(SUM(CASE WHEN ae.id_estado = 2 THEN 1 ELSE 0 END), 0) AS en_proceso
      FROM acciones_educativas ae
      INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
      WHERE YEAR(ae.fecha_programada) = @anio
    `
    if (id_distrito !== null && id_distrito > 0) {
      mesReq.input('distrito', sql.Int, id_distrito)
      mesQuery += ` AND u.id_distrito = @distrito`
    }
    mesQuery += ` GROUP BY MONTH(ae.fecha_programada) ORDER BY mes ASC`

    const mesRes = await mesReq.query(mesQuery)
    let foundMonths = 0
    for (const r of mesRes.recordset) {
      const mNum = Number(r.mes)
      if (mNum >= 1 && mNum <= 12) {
        mesesCompletos[mNum - 1].programadas = Number(r.programadas || 0)
        mesesCompletos[mNum - 1].finalizadas = Number(r.finalizadas || 0)
        mesesCompletos[mNum - 1].en_proceso = Number(r.en_proceso || 0)
        if (Number(r.programadas || 0) > 0) foundMonths++
      }
    }

    if (foundMonths === 0) {
      // Fallback desglose mensual legacy
      try {
        const legPool = await getPool()
        const legMesReq = legPool.request()
        let legMesQuery = `
          SELECT 
            COALESCE(MONTH(TRY_CONVERT(DATE, ti.fecha)), MONTH(TRY_CONVERT(DATE, ti.fecha, 103)), MONTH(TRY_CONVERT(DATE, ti.fecha, 120)), 1) AS mes,
            COUNT(*) AS programadas,
            ISNULL(SUM(CASE WHEN ti.status = 3 THEN 1 ELSE 0 END), 0) AS finalizadas,
            ISNULL(SUM(CASE WHEN ti.status = 2 THEN 1 ELSE 0 END), 0) AS en_proceso
          FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
          LEFT JOIN sisec_usuarios u ON ti.idusuario = u.idusuario
          WHERE ti.status IN (1, 2, 3)
        `
        if (id_distrito !== null && id_distrito > 0) {
          legMesReq.input('sede', sql.TinyInt, id_distrito)
          legMesQuery += ` AND u.idsede = @sede`
        }
        legMesQuery += ` GROUP BY COALESCE(MONTH(TRY_CONVERT(DATE, ti.fecha)), MONTH(TRY_CONVERT(DATE, ti.fecha, 103)), MONTH(TRY_CONVERT(DATE, ti.fecha, 120)), 1) ORDER BY mes ASC`
        const legMesRes = await legMesReq.query(legMesQuery)
        for (const r of (legMesRes.recordset || [])) {
          const mNum = Number(r.mes)
          if (mNum >= 1 && mNum <= 12) {
            mesesCompletos[mNum - 1].programadas = Number(r.programadas || 0)
            mesesCompletos[mNum - 1].finalizadas = Number(r.finalizadas || 0)
            mesesCompletos[mNum - 1].en_proceso = Number(r.en_proceso || 0)
          }
        }
      } catch (legMesErr) {
        logger.warn(`[METAS] Error fallback en legMesQuery: ${legMesErr.message}`)
      }
    }
  } catch (err) {
    logger.warn(`[METAS] Advertencia leyendo desglose mensual: ${err.message}`)
  }

  const porcentaje = metaActual > 0 ? Number(((finalizadas / metaActual) * 100).toFixed(2)) : 0

  return {
    anio,
    id_distrito: id_distrito ?? 0,
    meta_actual: metaActual,
    total_acciones: totalAcciones,
    finalizadas,
    capturadas,
    sin_capturar: sinCapturar,
    porcentaje,
    semi_circle_pct: Math.min(100, porcentaje),
    desglose_mensual: mesesCompletos
  }
}
