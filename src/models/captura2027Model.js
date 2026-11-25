// Modelo de Captura y Evidencias 2027
import { getNewPool, getPool, sql } from '../config/db.js'

export const getCapturaByAccion = async (id_acciones_educativas) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'captura'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id', sql.Int, id_acciones_educativas)
    const result = await request.query(`
      SELECT 
        c.*,
        ae.folio_accion_educativa,
        ae.id_estado,
        e.estado_accion,
        ca.clave_accion,
        ca.nombre_accion,
        ca.color
      FROM captura c
      INNER JOIN acciones_educativas ae ON c.id_acciones_educativas = ae.id_acciones_educativas
      INNER JOIN cat_acciones ca ON ae.id_accion = ca.id_accion
      INNER JOIN estados e ON ae.id_estado = e.id_estado
      WHERE c.id_acciones_educativas = @id
    `)
    return result.recordset[0] || null
  }

  // Fallback transicional
  const fallbackPool = await getPool()
  const request = fallbackPool.request()
  request.input('id', sql.Int, id_acciones_educativas)
  const result = await request.query(`
    SELECT 
      ti.idcurso AS id_acciones_educativas,
      ti.modalidad,
      ti.duracionhrs,
      ti.duracionmin,
      ti.pmujeres1, ti.pmujeres2, ti.pmujeres3, ti.pmujeres4,
      ti.pmujeres5, ti.pmujeres6, ti.pmujeres7, ti.pmujeres8,
      ti.phombres1, ti.phombres2, ti.phombres3, ti.phombres4,
      ti.phombres5, ti.phombres6, ti.phombres7, ti.phombres8,
      ti.nombre_archivo AS formato_registro_accion_pdf,
      ti.nombre_archivo2 AS formato_asistencia_accion_pdf,
      ti.nombre_archivo3 AS evidencia_fotografia,
      ti.status
    FROM sisecycc2024.dbo.sisec_talleres_intervenciones ti
    WHERE ti.idcurso = @id
  `)
  return result.recordset[0] || null
}

export const getSiguienteFolioAccion = async (id_distrito) => {
  const pool = await getNewPool()
  const distNum = Number(id_distrito !== undefined && id_distrito !== null ? id_distrito : 1)
  const distStr = String(distNum).padStart(2, '0')
  const prefix = distNum === 0 ? 'AE-CEN-2027-' : `AE-DD${distStr}-2027-`

  const req = pool.request()
  req.input('distrito', sql.Int, distNum)
  req.input('prefixPattern', sql.VarChar(30), `${prefix}%`)

  const result = await req.query(`
    SELECT ISNULL(MAX(TRY_CAST(RIGHT(ae.folio_accion_educativa, 4) AS INT)), 0) + 1 AS siguiente
    FROM acciones_educativas ae
    INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
    WHERE u.id_distrito = @distrito
      AND ae.folio_accion_educativa LIKE @prefixPattern
  `)

  const siguiente = Number(result.recordset[0]?.siguiente || 1)
  return `${prefix}${String(siguiente).padStart(4, '0')}`
}

export const guardarCapturaInicial = async (id_acciones_educativas, payload, filenames, id_distrito) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'captura'
  `)

  if (checkTable.recordset.length > 0) {
    // 1. Obtener si la acción ya tiene folio asignado o el distrito real del usuario que la creó
    const reqCheck = pool.request()
    reqCheck.input('id', sql.Int, id_acciones_educativas)
    const checkRes = await reqCheck.query(`
      SELECT ae.folio_accion_educativa, u.id_distrito
      FROM acciones_educativas ae
      INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
      WHERE ae.id_acciones_educativas = @id
    `)

    const rowAccion = checkRes.recordset[0]
    const distritoReal = (rowAccion?.id_distrito !== undefined && rowAccion?.id_distrito !== null)
      ? rowAccion.id_distrito
      : (id_distrito !== undefined && id_distrito !== null ? id_distrito : 1)

    let folioFinal = rowAccion?.folio_accion_educativa
    if (!folioFinal) {
      folioFinal = await getSiguienteFolioAccion(distritoReal)
    }

    // 2. Asignar folio inmutable y actualizar estado a Capturada (2)
    const reqAccion = pool.request()
    reqAccion.input('id', sql.Int, id_acciones_educativas)
    reqAccion.input('folio', sql.VarChar(30), folioFinal)
    await reqAccion.query(`
      UPDATE acciones_educativas
      SET 
        folio_accion_educativa = COALESCE(folio_accion_educativa, @folio),
        id_estado = CASE WHEN id_estado = 1 THEN 2 ELSE id_estado END,
        fecha_modif = GETDATE()
      WHERE id_acciones_educativas = @id
    `)

    // 2. Insertar o actualizar la fila de captura
    const reqCap = pool.request()
    reqCap.input('id_acciones_educativas', sql.Int, id_acciones_educativas)
    reqCap.input('modalidad', sql.Bit, payload.modalidad ? 1 : 0)
    reqCap.input('fecha_realizacion_accion', sql.DateTime, payload.fecha_realizacion_accion || new Date())
    reqCap.input('duracion_hora', sql.VarChar(5), payload.duracion_hora || '01:00')
    reqCap.input('duracion_real_actividad', sql.VarChar(5), String(payload.duracion_real_actividad || '1'))

    // Matriz de 5 géneros x 6 grupos de edad
    const generos = ['mujeres', 'hombres', 'no_binario', 'Otro', 'prefiero_no_decirlo']
    for (const g of generos) {
      for (let i = 1; i <= 6; i++) {
        const key = `G_${g}_${i}`
        reqCap.input(key, sql.Int, Number(payload[key] || 0))
      }
    }

    reqCap.input('formato_registro_accion_pdf', sql.VarChar(255), filenames.formato_registro_accion_pdf || null)
    reqCap.input('formato_asistencia_accion_pdf', sql.VarChar(255), filenames.formato_asistencia_accion_pdf || null)
    reqCap.input('evidencia_fotografia', sql.VarChar(255), filenames.evidencia_fotografia || null)

    await reqCap.query(`
      IF EXISTS (SELECT 1 FROM captura WHERE id_acciones_educativas = @id_acciones_educativas)
      BEGIN
        UPDATE captura
        SET 
          modalidad = @modalidad,
          fecha_realizacion_accion = @fecha_realizacion_accion,
          duracion_hora = @duracion_hora,
          duracion_real_actividad = @duracion_real_actividad,
          G_mujeres_1 = @G_mujeres_1, G_mujeres_2 = @G_mujeres_2, G_mujeres_3 = @G_mujeres_3,
          G_mujeres_4 = @G_mujeres_4, G_mujeres_5 = @G_mujeres_5, G_mujeres_6 = @G_mujeres_6,
          G_hombres_1 = @G_hombres_1, G_hombres_2 = @G_hombres_2, G_hombres_3 = @G_hombres_3,
          G_hombres_4 = @G_hombres_4, G_hombres_5 = @G_hombres_5, G_hombres_6 = @G_hombres_6,
          G_no_binario_1 = @G_no_binario_1, G_no_binario_2 = @G_no_binario_2, G_no_binario_3 = @G_no_binario_3,
          G_no_binario_4 = @G_no_binario_4, G_no_binario_5 = @G_no_binario_5, G_no_binario_6 = @G_no_binario_6,
          G_Otro_1 = @G_Otro_1, G_Otro_2 = @G_Otro_2, G_Otro_3 = @G_Otro_3,
          G_Otro_4 = @G_Otro_4, G_Otro_5 = @G_Otro_5, G_Otro_6 = @G_Otro_6,
          G_prefiero_no_decirlo_1 = @G_prefiero_no_decirlo_1, G_prefiero_no_decirlo_2 = @G_prefiero_no_decirlo_2,
          G_prefiero_no_decirlo_3 = @G_prefiero_no_decirlo_3, G_prefiero_no_decirlo_4 = @G_prefiero_no_decirlo_4,
          G_prefiero_no_decirlo_5 = @G_prefiero_no_decirlo_5, G_prefiero_no_decirlo_6 = @G_prefiero_no_decirlo_6,
          formato_registro_accion_pdf = COALESCE(@formato_registro_accion_pdf, formato_registro_accion_pdf),
          formato_asistencia_accion_pdf = COALESCE(@formato_asistencia_accion_pdf, formato_asistencia_accion_pdf),
          evidencia_fotografia = COALESCE(@evidencia_fotografia, evidencia_fotografia),
          fecha_modif = GETDATE()
        WHERE id_acciones_educativas = @id_acciones_educativas
      END
      ELSE
      BEGIN
        INSERT INTO captura (
          id_acciones_educativas, modalidad, fecha_realizacion_accion,
          duracion_hora, duracion_real_actividad,
          G_mujeres_1, G_mujeres_2, G_mujeres_3, G_mujeres_4, G_mujeres_5, G_mujeres_6,
          G_hombres_1, G_hombres_2, G_hombres_3, G_hombres_4, G_hombres_5, G_hombres_6,
          G_no_binario_1, G_no_binario_2, G_no_binario_3, G_no_binario_4, G_no_binario_5, G_no_binario_6,
          G_Otro_1, G_Otro_2, G_Otro_3, G_Otro_4, G_Otro_5, G_Otro_6,
          G_prefiero_no_decirlo_1, G_prefiero_no_decirlo_2, G_prefiero_no_decirlo_3,
          G_prefiero_no_decirlo_4, G_prefiero_no_decirlo_5, G_prefiero_no_decirlo_6,
          formato_registro_accion_pdf, formato_asistencia_accion_pdf, evidencia_fotografia,
          status, fecha_alta
        )
        VALUES (
          @id_acciones_educativas, @modalidad, @fecha_realizacion_accion,
          @duracion_hora, @duracion_real_actividad,
          @G_mujeres_1, @G_mujeres_2, @G_mujeres_3, @G_mujeres_4, @G_mujeres_5, @G_mujeres_6,
          @G_hombres_1, @G_hombres_2, @G_hombres_3, @G_hombres_4, @G_hombres_5, @G_hombres_6,
          @G_no_binario_1, @G_no_binario_2, @G_no_binario_3, @G_no_binario_4, @G_no_binario_5, @G_no_binario_6,
          @G_Otro_1, @G_Otro_2, @G_Otro_3, @G_Otro_4, @G_Otro_5, @G_Otro_6,
          @G_prefiero_no_decirlo_1, @G_prefiero_no_decirlo_2, @G_prefiero_no_decirlo_3,
          @G_prefiero_no_decirlo_4, @G_prefiero_no_decirlo_5, @G_prefiero_no_decirlo_6,
          @formato_registro_accion_pdf, @formato_asistencia_accion_pdf, @evidencia_fotografia,
          1, GETDATE()
        )
      END
    `)

    return { folio_accion_educativa: folioFinal, id_estado: 2, estado_accion: 'Capturada' }
  }

  // Fallback hacia tabla existente
  const fallbackPool = await getPool()
  const formattedDistrito = String(id_distrito || 1).padStart(2, '0')
  const formattedId = String(id_acciones_educativas).padStart(4, '0')
  const nuevoFolioAccionFallback = `AE-DD${formattedDistrito}-2027-${formattedId}`

  const request = fallbackPool.request()
  request.input('idcurso', sql.Int, id_acciones_educativas)
  request.input('modalidad', sql.Bit, payload.modalidad ? 1 : 0)
  request.input('duracionhrs', sql.Int, parseInt(String(payload.duracion_hora || '1').split(':')[0], 10) || 1)
  request.input('duracionmin', sql.Int, parseInt(String(payload.duracion_hora || '0').split(':')[1], 10) || 0)
  request.input('nombre_archivo', sql.VarChar(80), filenames.formato_registro_accion_pdf || null)
  request.input('nombre_archivo2', sql.VarChar(80), filenames.formato_asistencia_accion_pdf || null)
  request.input('nombre_archivo3', sql.VarChar(80), filenames.evidencia_fotografia || null)

  await request.query(`
    UPDATE sisecycc2024.dbo.sisec_talleres_intervenciones
    SET 
      modalidad = @modalidad,
      duracionhrs = @duracionhrs,
      duracionmin = @duracionmin,
      nombre_archivo = COALESCE(@nombre_archivo, nombre_archivo),
      nombre_archivo2 = COALESCE(@nombre_archivo2, nombre_archivo2),
      nombre_archivo3 = COALESCE(@nombre_archivo3, nombre_archivo3),
      status = 3
    WHERE idcurso = @idcurso
  `)

  return { folio_accion_educativa: nuevoFolioAccionFallback, id_estado: 2, estado_accion: 'Capturada' }
}

export const finalizarAccion = async (id_acciones_educativas, archivoEncuestas) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'captura'
  `)

  if (checkTable.recordset.length > 0) {
    // 1. Guardar ruta del archivo 4
    const reqCap = pool.request()
    reqCap.input('id', sql.Int, id_acciones_educativas)
    reqCap.input('encuesta_pdf', sql.VarChar(255), archivoEncuestas)
    await reqCap.query(`
      UPDATE captura
      SET encuesta_satisfaccion_pdf = @encuesta_pdf, fecha_modif = GETDATE()
      WHERE id_acciones_educativas = @id
    `)

    // 2. Transición irreversible al estado 3: Finalizada
    const reqAcc = pool.request()
    reqAcc.input('id', sql.Int, id_acciones_educativas)
    await reqAcc.query(`
      UPDATE acciones_educativas
      SET id_estado = 3, fecha_modif = GETDATE()
      WHERE id_acciones_educativas = @id
    `)

    return { id_estado: 3, estado_accion: 'Finalizada' }
  }

  // Fallback
  return { id_estado: 3, estado_accion: 'Finalizada' }
}
