// Modelo de Acciones Educativas 2027
import { getNewPool, getPool, sql } from '../config/db.js'

export const createAccionEducativa = async (payload) => {
  const pool = await getNewPool()
  
  // 1. Verificar si existe la tabla nueva en BD
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'acciones_educativas'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('con_convenio', sql.Bit, payload.con_convenio ? 1 : 0)
    request.input('id_accion', sql.Int, payload.id_accion)
    request.input('id_tipo_institucion', sql.Int, payload.id_tipo_institucion)
    request.input('nombre_institucion', sql.VarChar(150), payload.nombre_institucion)
    request.input('calle_numero', sql.VarChar(150), payload.calle_numero)
    request.input('colonia', sql.VarChar(100), payload.colonia)
    request.input('id_demarcacion', sql.Int, payload.id_demarcacion)
    request.input('cp', sql.VarChar(5), String(payload.cp).padStart(5, '0').slice(0, 5))
    request.input('grupo_poblacion_atendida', sql.VarChar(150), payload.grupo_poblacion_atendida || null)
    request.input('nombre_contacto', sql.VarChar(100), payload.nombre_contacto)
    request.input('telefono_contacto', sql.VarChar(20), payload.telefono_contacto)
    request.input('num_personas_atender', sql.Int, Number(payload.num_personas_atender))
    request.input('fecha_programada', sql.DateTime, payload.fecha_programada)
    request.input('hora_programada', sql.VarChar(5), payload.hora_programada)
    request.input('nombre_cargo_persona_atendera', sql.VarChar(150), payload.nombre_cargo_persona_atendera)
    request.input('id_usuario', sql.Int, payload.id_usuario)

    const result = await request.query(`
      INSERT INTO acciones_educativas (
        con_convenio, id_accion, id_tipo_institucion, nombre_institucion,
        calle_numero, colonia, id_demarcacion, cp, grupo_poblacion_atendida,
        nombre_contacto, telefono_contacto, num_personas_atender,
        fecha_programada, hora_programada, nombre_cargo_persona_atendera,
        id_usuario, id_estado, status, fecha_alta
      )
      OUTPUT INSERTED.id_acciones_educativas
      VALUES (
        @con_convenio, @id_accion, @id_tipo_institucion, @nombre_institucion,
        @calle_numero, @colonia, @id_demarcacion, @cp, @grupo_poblacion_atendida,
        @nombre_contacto, @telefono_contacto, @num_personas_atender,
        @fecha_programada, @hora_programada, @nombre_cargo_persona_atendera,
        @id_usuario, 1, 1, GETDATE()
      )
    `)
    return result.recordset[0]?.id_acciones_educativas
  }

  // 2. Fallback compatible hacia el esquema transicional
  const fallbackPool = await getPool()
  const request = fallbackPool.request()
  request.input('idcatcurso', sql.Int, payload.id_accion || 1)
  request.input('vertiente', sql.Int, payload.id_vertiente || 5)
  request.input('idtipopublico', sql.Int, payload.id_tipo_institucion || 1)
  request.input('fecha', sql.VarChar(10), String(payload.fecha_programada).split('T')[0])
  request.input('lugar', sql.VarChar(150), payload.nombre_institucion)
  request.input('direccion', sql.VarChar(50), String(payload.calle_numero || '').slice(0, 50))
  request.input('colonia', sql.VarChar(50), String(payload.colonia || '').slice(0, 50))
  request.input('cp', sql.VarChar(6), String(payload.cp || '').slice(0, 6))
  request.input('iddelegacion', sql.Int, payload.id_demarcacion || 1)
  request.input('tipoinstitucion', sql.Int, payload.id_tipo_institucion || 1)
  request.input('duracionhrs', sql.Int, 0)
  request.input('duracionmin', sql.Int, 0)
  request.input('comentarios', sql.VarChar(250), payload.grupo_poblacion_atendida ? `Población: ${payload.grupo_poblacion_atendida}`.slice(0, 250) : '')
  request.input('convenio', sql.Int, payload.con_convenio ? 1 : 0)
  request.input('idusuario', sql.Int, payload.id_usuario)
  request.input('fecha_alta', sql.VarChar(10), new Date().toISOString().slice(0, 10))
  request.input('hora_alta', sql.VarChar(10), payload.hora_programada || '09:00')
  request.input('status', sql.Int, 1)
  request.input('nombre_contacto', sql.VarChar(80), String(payload.nombre_contacto || '').slice(0, 80))
  request.input('telefono_contacto', sql.VarChar(30), String(payload.telefono_contacto || '').slice(0, 30))
  request.input('num_personas', sql.Int, Number(payload.num_personas_atender || 0))
  request.input('personal_distrito', sql.VarChar(250), String(payload.nombre_cargo_persona_atendera || '').slice(0, 250))
  const idDistritoParam = (payload.id_distrito !== undefined && payload.id_distrito !== null) ? Number(payload.id_distrito) : 0
  request.input('id_distrito', sql.TinyInt, idDistritoParam)

  const res = await request.query(`
    INSERT INTO sisecycc2024.dbo.sisec_talleres_intervenciones (
      idcatcurso, vertiente, idtipopublico, fecha, lugar, direccion, colonia, cp, iddelegacion,
      tipoinstitucion, duracionhrs, duracionmin, comentarios, convenio, idusuario,
      fecha_alta, hora_alta, status, nombre_contacto, telefono_contacto, num_personas,
      personal_distrito, id_distrito
    )
    OUTPUT INSERTED.idcurso
    VALUES (
      @idcatcurso, @vertiente, @idtipopublico, @fecha, @lugar, @direccion, @colonia, @cp, @iddelegacion,
      @tipoinstitucion, @duracionhrs, @duracionmin, @comentarios, @convenio, @idusuario,
      @fecha_alta, @hora_alta, @status, @nombre_contacto, @telefono_contacto, @num_personas,
      @personal_distrito, @id_distrito
    )
  `)
  return res.recordset[0]?.idcurso
}

export const listAccionesByDistrito = async (id_distrito) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'acciones_educativas'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id_distrito', sql.Int, id_distrito)
    const result = await request.query(`
      SELECT 
        ae.id_acciones_educativas,
        ae.folio_accion_educativa,
        ae.con_convenio,
        ae.id_accion,
        ca.clave_accion,
        ca.nombre_accion,
        ca.color,
        cv.vertiente,
        cv.color AS color_vertiente,
        ae.id_tipo_institucion,
        cti.descripcion AS tipo_institucion,
        ae.nombre_institucion,
        ae.calle_numero,
        ae.colonia,
        ae.id_demarcacion,
        cd.demarcacion,
        ae.cp,
        ae.grupo_poblacion_atendida,
        ae.nombre_contacto,
        ae.telefono_contacto,
        ae.num_personas_atender,
        ae.fecha_programada,
        ae.hora_programada,
        ae.nombre_cargo_persona_atendera,
        ae.id_estado,
        e.estado_accion,
        ae.motivo_cancelacion,
        ae.status,
        u.id_distrito,
        c.id_captura,
        c.modalidad,
        c.fecha_realizacion_accion,
        c.duracion_hora,
        c.duracion_real_actividad,
        c.formato_registro_accion_pdf,
        c.formato_asistencia_accion_pdf,
        c.evidencia_fotografia,
        c.encuesta_satisfaccion_pdf,
        (SELECT COUNT(*) FROM encuestas enc WHERE enc.id_acciones_educativas = ae.id_acciones_educativas) AS total_encuestas
      FROM acciones_educativas ae
      INNER JOIN cat_acciones ca ON ae.id_accion = ca.id_accion
      LEFT JOIN cat_vertientes cv ON ca.id_vertiente = cv.id_vertiente
      LEFT JOIN cat_tipo_institucion cti ON ae.id_tipo_institucion = cti.id_tipo_institucion
      LEFT JOIN cat_demarcacion cd ON ae.id_demarcacion = cd.id_demarcacion
      LEFT JOIN estados e ON ae.id_estado = e.id_estado
      INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
      LEFT JOIN captura c ON ae.id_acciones_educativas = c.id_acciones_educativas
      WHERE u.id_distrito = @id_distrito
      ORDER BY 
        CASE ae.id_estado
          WHEN 1 THEN 1
          WHEN 2 THEN 2
          WHEN 3 THEN 3
          WHEN 4 THEN 4
          ELSE 5
        END ASC,
        ae.fecha_programada DESC,
        ae.id_acciones_educativas DESC
    `)
    return result.recordset
  }

  // Fallback con datos de BD activa mapeados a la interfaz 2027
  const fallbackPool = await getPool()
  const request = fallbackPool.request()
  request.input('idsede', sql.TinyInt, id_distrito)
  const result = await request.query(`
    SELECT 
      ti.idcurso AS id_acciones_educativas,
      CASE 
        WHEN ti.id_distrito = 0 THEN ('AE-CEN-' + RIGHT('0000' + CAST(ti.idcurso AS VARCHAR), 4))
        ELSE ('AE-' + RIGHT('00' + CAST(ti.id_distrito AS VARCHAR), 2) + '-' + RIGHT('0000' + CAST(ti.idcurso AS VARCHAR), 4))
      END AS folio_accion_educativa,
      ti.convenio AS con_convenio,
      ti.idcatcurso AS id_accion,
      COALESCE(cc.descripcion, 'Acción Educativa') AS nombre_accion,
      ti.lugar AS nombre_institucion,
      ti.fecha AS fecha_programada,
      ti.hora_programada,
      ti.status,
      ti.motivo_norealizada AS motivo_cancelacion,
      ti.modalidad,
      ti.nombre_archivo AS formato_registro_accion_pdf,
      ti.nombre_archivo2 AS formato_asistencia_accion_pdf,
      ti.nombre_archivo3 AS evidencia_fotografia,
      ti.duracionhrs,
      ti.duracionmin
    FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
    LEFT JOIN sisecycc2024.dbo.sisec_cat_cursos cc ON ti.idcatcurso = cc.idcurso
    INNER JOIN sisec_usuarios u ON ti.idusuario = u.idusuario
    WHERE u.idsede = @idsede
    ORDER BY ti.fecha DESC, ti.idcurso DESC
  `)

  return result.recordset.map((row) => {
    // Mapear status viejo (1: prog, 2: cancelada, 3: realizada) a los 4 estados 2027
    let id_estado = 1
    let estado_accion = 'Sin capturar'
    if (row.status === 2) {
      id_estado = 4
      estado_accion = 'Cancelada'
    } else if (row.status === 3) {
      if (row.formato_registro_accion_pdf && row.formato_asistencia_accion_pdf && row.evidencia_fotografia) {
        id_estado = 3
        estado_accion = 'Finalizada'
      } else {
        id_estado = 2
        estado_accion = 'Capturada'
      }
    }

    const clave = 'AE-' + String(row.id_accion || 1).padStart(2, '0')

    return {
      id_acciones_educativas: row.id_acciones_educativas,
      folio_accion_educativa: row.folio_accion_educativa,
      con_convenio: row.con_convenio === 1,
      id_accion: row.id_accion,
      clave_accion: clave,
      nombre_accion: row.nombre_accion || 'Acción Educativa',
      vertiente: 'General',
      color: '#6B2D8B',
      tipo_institucion: 'Espacio Educativo',
      nombre_institucion: row.nombre_institucion,
      calle_numero: 'Domicilio registrado',
      colonia: 'Colonia registrada',
      demarcacion: 'Demarcación territorial',
      cp: '00000',
      nombre_contacto: 'Contacto enlace',
      telefono_contacto: '5500000000',
      num_personas_atender: 30,
      fecha_programada: row.fecha_programada,
      hora_programada: row.hora_programada || '10:00',
      nombre_cargo_persona_atendera: 'Personal comisionado',
      id_estado,
      estado_accion,
      motivo_cancelacion: row.motivo_cancelacion,
      status: row.status !== 2 ? 1 : 0,
      modalidad: row.modalidad,
      formato_registro_accion_pdf: row.formato_registro_accion_pdf,
      formato_asistencia_accion_pdf: row.formato_asistencia_accion_pdf,
      evidencia_fotografia: row.evidencia_fotografia,
      encuesta_satisfaccion_pdf: null,
      total_encuestas: 0
    }
  })
}

export const reprogramarAccion = async (id_acciones_educativas, fecha, hora) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'acciones_educativas'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id', sql.Int, id_acciones_educativas)
    request.input('fecha', sql.DateTime, fecha)
    request.input('hora', sql.VarChar(5), hora)
    await request.query(`
      UPDATE acciones_educativas
      SET fecha_programada = @fecha, hora_programada = @hora, fecha_modif = GETDATE()
      WHERE id_acciones_educativas = @id
    `)
    return
  }

  // Fallback
  const fallbackPool = await getPool()
  const request = fallbackPool.request()
  request.input('id', sql.Int, id_acciones_educativas)
  request.input('fecha', sql.VarChar(10), String(fecha).split('T')[0])
  request.input('hora', sql.VarChar(10), hora)
  await request.query(`
    UPDATE sisecycc2024.dbo.sisec_talleres_intervenciones
    SET fecha = @fecha, hora_programada = @hora
    WHERE idcurso = @id
  `)
}

export const cancelarAccion = async (id_acciones_educativas, motivo) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'acciones_educativas'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id', sql.Int, id_acciones_educativas)
    request.input('motivo', sql.VarChar(250), String(motivo || '').slice(0, 250))
    await request.query(`
      UPDATE acciones_educativas
      SET id_estado = 4, status = 0, motivo_cancelacion = @motivo, fecha_modif = GETDATE()
      WHERE id_acciones_educativas = @id
    `)
    return
  }

  // Fallback
  const fallbackPool = await getPool()
  const request = fallbackPool.request()
  request.input('id', sql.Int, id_acciones_educativas)
  request.input('motivo', sql.VarChar(250), String(motivo || '').slice(0, 250))
  await request.query(`
    UPDATE sisecycc2024.dbo.sisec_talleres_intervenciones
    SET motivo_norealizada = @motivo, status = 2
    WHERE idcurso = @id
  `)
}

export const listAllAccionesAdmin = async (filtros = {}) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'acciones_educativas'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    let query = `
      SELECT 
        ae.id_acciones_educativas,
        ae.folio_accion_educativa,
        ae.con_convenio,
        ae.id_accion,
        ca.clave_accion,
        ca.nombre_accion,
        ca.color,
        cv.vertiente,
        cv.color AS color_vertiente,
        ae.id_tipo_institucion,
        cti.descripcion AS tipo_institucion,
        ae.nombre_institucion,
        ae.calle_numero,
        ae.colonia,
        ae.id_demarcacion,
        cd.demarcacion,
        ae.cp,
        ae.grupo_poblacion_atendida,
        ae.nombre_contacto,
        ae.telefono_contacto,
        ae.num_personas_atender,
        ae.fecha_programada,
        ae.hora_programada,
        ae.nombre_cargo_persona_atendera,
        ae.id_estado,
        e.estado_accion,
        ae.motivo_cancelacion,
        ae.status,
        u.id_distrito,
        CASE WHEN u.id_distrito = 0 THEN 'Central' ELSE d.distrito END AS distrito,
        c.id_captura,
        c.modalidad,
        c.fecha_realizacion_accion,
        c.duracion_hora,
        c.duracion_real_actividad,
        c.formato_registro_accion_pdf,
        c.formato_asistencia_accion_pdf,
        c.evidencia_fotografia,
        c.encuesta_satisfaccion_pdf,
        (SELECT COUNT(*) FROM encuestas enc WHERE enc.id_acciones_educativas = ae.id_acciones_educativas) AS total_encuestas
      FROM acciones_educativas ae
      INNER JOIN cat_acciones ca ON ae.id_accion = ca.id_accion
      LEFT JOIN cat_vertientes cv ON ca.id_vertiente = cv.id_vertiente
      LEFT JOIN cat_tipo_institucion cti ON ae.id_tipo_institucion = cti.id_tipo_institucion
      LEFT JOIN cat_demarcacion cd ON ae.id_demarcacion = cd.id_demarcacion
      LEFT JOIN estados e ON ae.id_estado = e.id_estado
      INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
      LEFT JOIN cat_distritos d ON u.id_distrito = d.id_distrito
      LEFT JOIN captura c ON ae.id_acciones_educativas = c.id_acciones_educativas
      WHERE 1=1
    `

    if (filtros.id_distrito !== undefined && filtros.id_distrito !== null && filtros.id_distrito !== '') {
      request.input('id_distrito', sql.Int, Number(filtros.id_distrito))
      query += ` AND u.id_distrito = @id_distrito`
    }
    if (filtros.id_estado) {
      request.input('id_estado', sql.Int, Number(filtros.id_estado))
      query += ` AND ae.id_estado = @id_estado`
    }
    if (filtros.fecha_desde) {
      request.input('fecha_desde', sql.Date, filtros.fecha_desde)
      query += ` AND ae.fecha_programada >= @fecha_desde`
    }
    if (filtros.fecha_hasta) {
      request.input('fecha_hasta', sql.Date, filtros.fecha_hasta)
      query += ` AND ae.fecha_programada <= @fecha_hasta`
    }

    query += ` ORDER BY 
      CASE ae.id_estado
        WHEN 1 THEN 1
        WHEN 2 THEN 2
        WHEN 3 THEN 3
        WHEN 4 THEN 4
        ELSE 5
      END ASC,
      ae.fecha_programada DESC,
      ae.id_acciones_educativas DESC`
    const result = await request.query(query)
    return result.recordset
  }

  // Fallback histórico para vista admin
  const fallbackPool = await getPool()
  const request = fallbackPool.request()
  let query = `
    SELECT 
      ti.idcurso AS id_acciones_educativas,
      CASE 
        WHEN ti.id_distrito = 0 THEN ('AE-CEN-' + RIGHT('0000' + CAST(ti.idcurso AS VARCHAR), 4))
        ELSE ('AE-' + RIGHT('00' + CAST(ti.id_distrito AS VARCHAR), 2) + '-' + RIGHT('0000' + CAST(ti.idcurso AS VARCHAR), 4))
      END AS folio_accion_educativa,
      ti.convenio AS con_convenio,
      ti.idcatcurso AS id_accion,
      COALESCE(cc.descripcion, 'Acción Educativa') AS nombre_accion,
      ti.lugar AS nombre_institucion,
      ti.fecha AS fecha_programada,
      ti.hora_programada,
      ti.status,
      ti.motivo_norealizada AS motivo_cancelacion,
      ti.modalidad,
      ti.nombre_archivo AS formato_registro_accion_pdf,
      ti.nombre_archivo2 AS formato_asistencia_accion_pdf,
      ti.nombre_archivo3 AS evidencia_fotografia,
      ti.duracionhrs,
      ti.duracionmin,
      ti.id_distrito,
      u.idsede
    FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
    LEFT JOIN sisecycc2024.dbo.sisec_cat_cursos cc ON ti.idcatcurso = cc.idcurso
    INNER JOIN sisec_usuarios u ON ti.idusuario = u.idusuario
    WHERE 1=1
  `

  if (filtros.id_distrito !== undefined && filtros.id_distrito !== null && filtros.id_distrito !== '') {
    request.input('idsede', sql.TinyInt, Number(filtros.id_distrito))
    query += ` AND (ti.id_distrito = @idsede OR u.idsede = @idsede)`
  }
  if (filtros.fecha_desde) {
    request.input('desde', sql.VarChar(10), filtros.fecha_desde)
    query += ` AND ti.fecha >= @desde`
  }
  if (filtros.fecha_hasta) {
    request.input('hasta', sql.VarChar(10), filtros.fecha_hasta)
    query += ` AND ti.fecha <= @hasta`
  }

  query += ` ORDER BY ti.fecha DESC, ti.idcurso DESC`
  const result = await request.query(query)

  return result.recordset.map((row) => {
    let id_estado = 1
    let estado_accion = 'Sin capturar'
    if (row.status === 2) {
      id_estado = 4
      estado_accion = 'Cancelada'
    } else if (row.status === 3) {
      if (row.formato_registro_accion_pdf && row.formato_asistencia_accion_pdf && row.evidencia_fotografia) {
        id_estado = 3
        estado_accion = 'Finalizada'
      } else {
        id_estado = 2
        estado_accion = 'Capturada'
      }
    }

    const clave = 'AE-' + String(row.id_accion || 1).padStart(2, '0')

    return {
      id_acciones_educativas: row.id_acciones_educativas,
      folio_accion_educativa: row.folio_accion_educativa,
      con_convenio: row.con_convenio === 1,
      id_accion: row.id_accion,
      clave_accion: clave,
      nombre_accion: row.nombre_accion || 'Acción Educativa',
      vertiente: 'General',
      color: '#6B2D8B',
      tipo_institucion: 'Espacio Educativo',
      nombre_institucion: row.nombre_institucion,
      calle_numero: 'Domicilio registrado',
      colonia: 'Colonia registrada',
      demarcacion: 'Demarcación territorial',
      cp: '00000',
      nombre_contacto: 'Contacto enlace',
      telefono_contacto: '5500000000',
      num_personas_atender: 30,
      fecha_programada: row.fecha_programada,
      hora_programada: row.hora_programada || '10:00',
      nombre_cargo_persona_atendera: 'Personal comisionado',
      id_distrito: (row.id_distrito !== undefined && row.id_distrito !== null) ? row.id_distrito : (row.idsede !== undefined ? row.idsede : 0),
      distrito: (row.id_distrito === 0 || row.idsede === 0) ? 'Central' : (row.id_distrito || row.idsede || 1),
      es_central: row.id_distrito === 0 || row.idsede === 0,
      id_estado,
      estado_accion,
      motivo_cancelacion: row.motivo_cancelacion,
      status: row.status !== 2 ? 1 : 0,
      modalidad: row.modalidad,
      formato_registro_accion_pdf: row.formato_registro_accion_pdf,
      formato_asistencia_accion_pdf: row.formato_asistencia_accion_pdf,
      evidencia_fotografia: row.evidencia_fotografia,
      encuesta_satisfaccion_pdf: null,
      total_encuestas: 0
    }
  })
}
