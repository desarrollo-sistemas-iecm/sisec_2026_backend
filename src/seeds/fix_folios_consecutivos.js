// Script para corregir y normalizar folios de acciones educativas y encuestas
// Regla: Consecutivos estrictos desde 0001 por cada distrito sin saltos
import { getNewPool, sql } from '../config/db.js'

export async function fixFoliosConsecutivos() {
  const pool = await getNewPool()
  console.log('🚀 Iniciando re-foliado consecutivo estricto por distrito...')

  let totalAccionesActualizadas = 0
  let totalEncuestasActualizadas = 0

  for (let distrito = 1; distrito <= 33; distrito++) {
    const distStr = String(distrito).padStart(2, '0')

    // 1. Obtener todas las acciones con folio del distrito, ordenadas cronológicamente
    const req = pool.request()
    req.input('distrito', sql.Int, distrito)
    const res = await req.query(`
      SELECT ae.id_acciones_educativas, ae.folio_accion_educativa, ae.fecha_alta
      FROM acciones_educativas ae
      INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
      WHERE u.id_distrito = @distrito AND ae.folio_accion_educativa IS NOT NULL
      ORDER BY ae.fecha_alta ASC, ae.id_acciones_educativas ASC
    `)

    const acciones = res.recordset

    for (let i = 0; i < acciones.length; i++) {
      const acc = acciones[i]
      const consecutivo = i + 1
      const nuevoFolio = `AE-DD${distStr}-2027-${String(consecutivo).padStart(4, '0')}`
      const folioViejo = acc.folio_accion_educativa

      // 2. Actualizar acción educativa
      const updAccReq = pool.request()
      updAccReq.input('id', sql.Int, acc.id_acciones_educativas)
      updAccReq.input('nuevoFolio', sql.VarChar(30), nuevoFolio)
      await updAccReq.query(`
        UPDATE acciones_educativas
        SET folio_accion_educativa = @nuevoFolio, fecha_modif = GETDATE()
        WHERE id_acciones_educativas = @id
      `)
      totalAccionesActualizadas++

      // 3. Actualizar encuestas asociadas
      const updEncReq = pool.request()
      updEncReq.input('id', sql.Int, acc.id_acciones_educativas)
      updEncReq.input('nuevoFolio', sql.VarChar(30), nuevoFolio)
      const encRes = await updEncReq.query(`
        UPDATE encuestas
        SET 
          folio_accion_educativa = @nuevoFolio,
          folio_encuesta = 'ENC-' + @nuevoFolio + '-' + CAST(consecutivo_encuesta AS VARCHAR)
        WHERE id_acciones_educativas = @id
      `)
      totalEncuestasActualizadas += encRes.rowsAffected[0] || 0
    }

    if (acciones.length > 0) {
      console.log(`✅ [Distrito ${distStr}] ${acciones.length} acciones re-foliadas (AE-DD${distStr}-2027-0001 a AE-DD${distStr}-2027-${String(acciones.length).padStart(4, '0')})`)
    }
  }

  console.log(`\n🎉 Re-foliado completado con éxito:`)
  console.log(`- Acciones educativas actualizadas: ${totalAccionesActualizadas}`)
  console.log(`- Encuestas actualizadas: ${totalEncuestasActualizadas}`)
}

if (process.argv[1]?.endsWith('fix_folios_consecutivos.js')) {
  fixFoliosConsecutivos()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error en fixFoliosConsecutivos:', err)
      process.exit(1)
    })
}
