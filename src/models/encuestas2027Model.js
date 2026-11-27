// Modelo de Encuestas 2027 (1 Acción : N Encuestas)
import { getNewPool, getPool, sql } from '../config/db.js'

export const getSiguienteConsecutivoEncuesta = async (id_acciones_educativas) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'encuestas'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id', sql.Int, id_acciones_educativas)
    const result = await request.query(`
      SELECT ISNULL(MAX(consecutivo_encuesta), 0) + 1 AS siguiente
      FROM encuestas
      WHERE id_acciones_educativas = @id
    `)
    return Number(result.recordset[0]?.siguiente || 1)
  }

  return 1
}

export const getSiguienteFolioEncuesta = async (id_acciones_educativas, folioAccionParam = '', id_distrito = 1, consecutivoParam = null) => {
  const pool = await getNewPool()
  let folioAccion = String(folioAccionParam || '').trim()
  let distNum = Number(id_distrito || 1)

  if (!folioAccion || folioAccion.toLowerCase().includes('sin folio')) {
    if (id_acciones_educativas) {
      const fRes = await pool.request()
        .input('id', sql.Int, id_acciones_educativas)
        .query(`
          SELECT ae.folio_accion_educativa, ISNULL(u.id_distrito, 1) AS id_distrito
          FROM acciones_educativas ae
          LEFT JOIN usuarios u ON ae.id_usuario = u.id_usuario
          WHERE ae.id_acciones_educativas = @id
        `)
      if (fRes.recordset.length > 0) {
        folioAccion = fRes.recordset[0].folio_accion_educativa || ''
        distNum = Number(fRes.recordset[0].id_distrito || distNum)
      }
    }
  }

  if (!folioAccion || folioAccion.toLowerCase().includes('sin folio')) {
    const distStr = String(distNum).padStart(2, '0')
    const actId = String(id_acciones_educativas || 1).padStart(4, '0')
    folioAccion = `AE-DD${distStr}-2027-F${actId}`
  }

  // Transformar prefijo de acción educativa (AE-...) al prefijo de encuesta (EN-...)
  let baseEncuesta = folioAccion
  if (baseEncuesta.startsWith('AE-')) {
    baseEncuesta = 'EN-' + baseEncuesta.substring(3)
  } else if (!baseEncuesta.startsWith('EN-')) {
    baseEncuesta = 'EN-' + baseEncuesta
  }

  const consecutivo = (consecutivoParam !== null && consecutivoParam !== undefined)
    ? Number(consecutivoParam)
    : await getSiguienteConsecutivoEncuesta(id_acciones_educativas)

  const consecutivoStr = String(consecutivo).padStart(2, '0')

  return `${baseEncuesta}-${consecutivoStr}`
}

export const registrarEncuesta2027 = async (payload) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'encuestas'
  `)

  let folioAccion = payload.folio_accion_educativa
  let idDistrito = payload.id_distrito || null

  const fRes = await pool.request()
    .input('id', sql.Int, payload.id_acciones_educativas)
    .query(`
      SELECT ae.folio_accion_educativa, ISNULL(u.id_distrito, 1) AS id_distrito
      FROM acciones_educativas ae
      LEFT JOIN usuarios u ON ae.id_usuario = u.id_usuario
      WHERE ae.id_acciones_educativas = @id
    `)

  if (fRes.recordset.length > 0) {
    if (!folioAccion) folioAccion = fRes.recordset[0].folio_accion_educativa
    if (!idDistrito) idDistrito = fRes.recordset[0].id_distrito
  }
  if (!idDistrito) idDistrito = 1
  if (!folioAccion) {
    const distStr = String(idDistrito).padStart(2, '0')
    const actId = String(payload.id_acciones_educativas).padStart(4, '0')
    folioAccion = `AE-DD${distStr}-2027-F${actId}`
    try {
      await pool.request()
        .input('id', sql.Int, payload.id_acciones_educativas)
        .input('folio', sql.VarChar(30), folioAccion)
        .query('UPDATE acciones_educativas SET folio_accion_educativa = @folio WHERE id_acciones_educativas = @id AND folio_accion_educativa IS NULL')
    } catch (e) {}
  }

  const consecutivo = await getSiguienteConsecutivoEncuesta(payload.id_acciones_educativas)
  const folioEncuesta = await getSiguienteFolioEncuesta(payload.id_acciones_educativas, folioAccion, idDistrito, consecutivo)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id_acciones_educativas', sql.Int, payload.id_acciones_educativas)
    request.input('folio_accion_educativa', sql.VarChar(30), folioAccion)
    request.input('folio_encuesta', sql.VarChar(30), folioEncuesta)
    request.input('consecutivo_encuesta', sql.Int, consecutivo)
    request.input('tipo_encuesta', sql.Int, Number(payload.tipo_encuesta || 1))
    request.input('p1_edad_persona_asistente', sql.Int, Number(payload.p1_edad_persona_asistente))
    request.input('id_genero', sql.Int, Number(payload.id_genero || 1))
    request.input('p3', sql.TinyInt, Number(payload.p3 || 1))
    request.input('p4', sql.TinyInt, Number(payload.p4 || 1))
    request.input('p5', sql.TinyInt, Number(payload.p5 || 1))
    request.input('p6', sql.TinyInt, Number(payload.p6 || 1))
    request.input('p7', sql.TinyInt, Number(payload.p7 || 1))
    request.input('p8', sql.TinyInt, Number(payload.p8 || 1))

    const result = await request.query(`
      INSERT INTO encuestas (
        id_acciones_educativas, folio_accion_educativa, folio_encuesta,
        consecutivo_encuesta, tipo_encuesta, p1_edad_persona_asistente, id_genero,
        p3, p4, p5, p6, p7, p8, status, fecha_alta
      )
      OUTPUT INSERTED.id_encuestas
      VALUES (
        @id_acciones_educativas, @folio_accion_educativa, @folio_encuesta,
        @consecutivo_encuesta, @tipo_encuesta, @p1_edad_persona_asistente, @id_genero,
        @p3, @p4, @p5, @p6, @p7, @p8, 1, GETDATE()
      )
    `)

    return {
      id_encuestas: result.recordset[0]?.id_encuestas,
      folio_encuesta: folioEncuesta,
      consecutivo_encuesta: consecutivo
    }
  }

  // Fallback transicional
  return {
    id_encuestas: Date.now(),
    folio_encuesta: folioEncuesta,
    consecutivo_encuesta: consecutivo
  }
}

export const listEncuestasPorAccion = async (id_acciones_educativas) => {
  const pool = await getNewPool()
  const checkTable = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'encuestas'
  `)

  if (checkTable.recordset.length > 0) {
    const request = pool.request()
    request.input('id', sql.Int, id_acciones_educativas)
    const result = await request.query(`
      SELECT 
        e.*,
        cg.genero
      FROM encuestas e
      INNER JOIN cat_generos cg ON e.id_genero = cg.id_genero
      WHERE e.id_acciones_educativas = @id
      ORDER BY e.consecutivo_encuesta ASC
    `)
    return result.recordset
  }

  return []
}
