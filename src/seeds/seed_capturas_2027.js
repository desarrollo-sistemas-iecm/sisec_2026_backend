// Script de sembrado masivo de Capturas 2027 por Distrito (20 por cada uno de los 33 distritos)
import { getNewPool, sql } from '../config/db.js'
import { getSiguienteFolioAccion } from '../models/captura2027Model.js'

export async function seedCapturas(capturasPorDistrito = 20) {
  const pool = await getNewPool()
  console.log(`🚀 Iniciando generación de ${capturasPorDistrito} capturas por distrito en los 33 distritos...`)

  let totalCapturadas = 0
  let totalFinalizadas = 0
  let totalEncuestas = 0

  for (let distrito = 1; distrito <= 33; distrito++) {
    // 1. Obtener las 20 acciones pendientes de este distrito
    const reqAcciones = pool.request()
    reqAcciones.input('distrito', sql.Int, distrito)
    reqAcciones.input('limite', sql.Int, capturasPorDistrito)
    
    const accionesRes = await reqAcciones.query(`
      SELECT TOP (@limite) 
        ae.id_acciones_educativas, 
        ae.fecha_programada,
        ae.folio_accion_educativa
      FROM acciones_educativas ae
      INNER JOIN usuarios u ON ae.id_usuario = u.id_usuario
      WHERE u.id_distrito = @distrito AND ae.id_estado = 1
      ORDER BY ae.id_acciones_educativas ASC
    `)

    const acciones = accionesRes.recordset
    if (acciones.length === 0) {
      console.log(`[Distrito ${distrito}] No hay acciones pendientes en estado 1.`)
      continue
    }

    const distStr = String(distrito).padStart(2, '0')

    for (let i = 0; i < acciones.length; i++) {
      const acc = acciones[i]
      const idAccion = acc.id_acciones_educativas
      let folioAccion = acc.folio_accion_educativa
      if (!folioAccion) {
        folioAccion = await getSiguienteFolioAccion(distrito)
      }

      // Alternar: la mitad Finalizadas (estado 3 = Verde) y la mitad Capturadas (estado 2 = Morado)
      const esFinalizada = i < Math.floor(capturasPorDistrito / 2)
      const idEstado = esFinalizada ? 3 : 2

      // A) Actualizar estado y folio en acciones_educativas
      const updReq = pool.request()
      updReq.input('id', sql.Int, idAccion)
      updReq.input('folio', sql.VarChar(30), folioAccion)
      updReq.input('id_estado', sql.Int, idEstado)
      await updReq.query(`
        UPDATE acciones_educativas
        SET 
          folio_accion_educativa = @folio,
          id_estado = @id_estado,
          fecha_modif = GETDATE()
        WHERE id_acciones_educativas = @id
      `)

      // B) Insertar o actualizar registro en tabla captura
      const capReq = pool.request()
      capReq.input('id_acciones_educativas', sql.Int, idAccion)
      capReq.input('modalidad', sql.Bit, i % 3 === 0 ? 1 : 0) // Mayoría presenciales
      capReq.input('fecha_realizacion', sql.DateTime, acc.fecha_programada || new Date())
      capReq.input('duracion_hora', sql.VarChar(5), '02:00')
      capReq.input('duracion_real', sql.VarChar(5), '2')

      // Matriz de beneficiarios con valores realistas (~35 personas por actividad)
      const distMujeres = [2, 3, 6, 4, 3, 1]
      const distHombres = [1, 2, 4, 3, 2, 1]
      
      for (let gIdx = 1; gIdx <= 6; gIdx++) {
        capReq.input(`G_mujeres_${gIdx}`, sql.Int, distMujeres[gIdx - 1])
        capReq.input(`G_hombres_${gIdx}`, sql.Int, distHombres[gIdx - 1])
        capReq.input(`G_no_binario_${gIdx}`, sql.Int, gIdx === 3 ? 1 : 0)
        capReq.input(`G_Otro_${gIdx}`, sql.Int, gIdx === 3 ? 1 : 0)
        capReq.input(`G_prefiero_no_decirlo_${gIdx}`, sql.Int, gIdx === 4 ? 1 : 0)
      }

      capReq.input('f1', sql.VarChar(255), `FORMATO_1_REGISTRO_${idAccion}.pdf`)
      capReq.input('f2', sql.VarChar(255), `FORMATO_2_ASISTENCIA_${idAccion}.pdf`)
      capReq.input('f3', sql.VarChar(255), `EVIDENCIA_FOTOGRAFICA_${idAccion}.jpg`)
      capReq.input('f4', sql.VarChar(255), esFinalizada ? `ENCUESTAS_CONSOLIDADAS_${idAccion}.pdf` : null)
      capReq.input('status_captura', sql.Bit, esFinalizada ? 1 : 1)

      await capReq.query(`
        IF EXISTS (SELECT 1 FROM captura WHERE id_acciones_educativas = @id_acciones_educativas)
        BEGIN
          UPDATE captura
          SET
            modalidad = @modalidad,
            fecha_realizacion_accion = @fecha_realizacion,
            duracion_hora = @duracion_hora,
            duracion_real_actividad = @duracion_real,
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
            formato_registro_accion_pdf = @f1,
            formato_asistencia_accion_pdf = @f2,
            evidencia_fotografia = @f3,
            encuesta_satisfaccion_pdf = @f4,
            status = @status_captura,
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
            encuesta_satisfaccion_pdf, status, fecha_alta
          )
          VALUES (
            @id_acciones_educativas, @modalidad, @fecha_realizacion,
            @duracion_hora, @duracion_real,
            @G_mujeres_1, @G_mujeres_2, @G_mujeres_3, @G_mujeres_4, @G_mujeres_5, @G_mujeres_6,
            @G_hombres_1, @G_hombres_2, @G_hombres_3, @G_hombres_4, @G_hombres_5, @G_hombres_6,
            @G_no_binario_1, @G_no_binario_2, @G_no_binario_3, @G_no_binario_4, @G_no_binario_5, @G_no_binario_6,
            @G_Otro_1, @G_Otro_2, @G_Otro_3, @G_Otro_4, @G_Otro_5, @G_Otro_6,
            @G_prefiero_no_decirlo_1, @G_prefiero_no_decirlo_2, @G_prefiero_no_decirlo_3,
            @G_prefiero_no_decirlo_4, @G_prefiero_no_decirlo_5, @G_prefiero_no_decirlo_6,
            @f1, @f2, @f3, @f4, @status_captura, GETDATE()
          )
        END
      `)

      // C) Si es finalizada, sembrar 3 encuestas de satisfacción individuales
      if (esFinalizada) {
        for (let c = 1; c <= 3; c++) {
          const encFolio = `ENC-${folioAccion}-${c}`
          const reqEnc = pool.request()
          reqEnc.input('id_acciones_educativas', sql.Int, idAccion)
          reqEnc.input('folio_accion_educativa', sql.VarChar(30), folioAccion)
          reqEnc.input('folio_encuesta', sql.VarChar(30), encFolio)
          reqEnc.input('consecutivo', sql.Int, c)
          reqEnc.input('edad', sql.Int, 20 + ((idAccion + c * 7) % 45))
          reqEnc.input('genero', sql.Int, (c % 2) + 1)
          reqEnc.input('p3', sql.TinyInt, 5)
          reqEnc.input('p4', sql.TinyInt, 5)
          reqEnc.input('p5', sql.TinyInt, 4)
          reqEnc.input('p6', sql.TinyInt, 5)
          reqEnc.input('p7', sql.TinyInt, 5)
          reqEnc.input('p8', sql.TinyInt, 5)

          await reqEnc.query(`
            IF NOT EXISTS (SELECT 1 FROM encuestas WHERE folio_encuesta = @folio_encuesta)
            BEGIN
              INSERT INTO encuestas (
                id_acciones_educativas, folio_accion_educativa, folio_encuesta,
                consecutivo_encuesta, tipo_encuesta, p1_edad_persona_asistente, id_genero,
                p3, p4, p5, p6, p7, p8, status, fecha_alta
              ) VALUES (
                @id_acciones_educativas, @folio_accion_educativa, @folio_encuesta,
                @consecutivo, 1, @edad, @genero,
                @p3, @p4, @p5, @p6, @p7, @p8, 1, GETDATE()
              )
            END
          `)
          totalEncuestas++
        }
        totalFinalizadas++
      } else {
        totalCapturadas++
      }
    }

    console.log(`[Distrito ${distrito}] Generadas ${acciones.length} capturas (10 Finalizadas, 10 En proceso).`)
  }

  console.log(`\n🎉 PROCESO CONCLUIDO CON ÉXITO:`)
  console.log(`   - Finalizadas (Verde): ${totalFinalizadas}`)
  console.log(`   - Capturadas en Proceso (Morado): ${totalCapturadas}`)
  console.log(`   - Encuestas de Satisfacción Generadas: ${totalEncuestas}`)
  console.log(`   - Total de Capturas Registradas: ${totalFinalizadas + totalCapturadas}`)
}

// Ejecutar si es llamado directamente
if (process.argv[1]?.includes('seed_capturas_2027')) {
  seedCapturas(20)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error al sembrar capturas:', err)
      process.exit(1)
    })
}
