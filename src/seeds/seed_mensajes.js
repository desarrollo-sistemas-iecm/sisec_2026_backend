import { getPool } from '../config/db.js';

async function seed() {
  const pool = await getPool();
  const count = await pool.request().query('SELECT COUNT(*) as c FROM cat_mensajes_predeterminados');
  if (count.recordset[0].c === 0) {
    await pool.request().query(`
      SET IDENTITY_INSERT cat_mensajes_predeterminados ON;
      INSERT INTO cat_mensajes_predeterminados (
        id_mensaje_predeterminado, codigo, titulo, cuerpo_mensaje, tipo_flujo, categoria,
        requiere_id_accion, permite_comentario_adicional, creado_por, status, fecha_alta
      )
      VALUES
      (1, 'SOL_LIBERACION_EXTEMPORANEA', 'Solicitud de liberación extemporánea de actividad', 'Por medio de la presente, se solicita la liberación para captura extemporánea de la acción educativa programada debido a causas de fuerza mayor.', 'DISTRITO_A_ADMIN', 'Liberación', 1, 1, 1, 1, GETDATE()),
      (2, 'NOTIF_ACCION_FINALIZADA', 'Acción educativa concluida con evidencias completas', 'Se hace de su conocimiento que la acción educativa ha sido debidamente capturada con sus formatos oficiales, fotografía y encuestas de satisfacción.', 'DISTRITO_A_ADMIN', 'Finalización', 1, 1, 1, 1, GETDATE()),
      (3, 'AVISO_RECORDATORIO_CAPTURA', 'Recordatorio urgente de captura de actividad programada', 'Estimado Distrito: Le recordamos que la acción educativa se encuentra en estado Sin Capturar y el plazo reglamentario está próximo a vencer.', 'ADMIN_A_DISTRITO', 'Aviso', 1, 1, 1, 1, GETDATE()),
      (4, 'SOL_PRORROGA_GLOBAL', 'Solicitud de prórroga extraordinaria de sistema', 'Se solicita al Superadministrador la autorización de una ampliación en la ventana de captura para atender incidencias distritales.', 'ADMIN_A_SUPERADMIN', 'Prórroga', 0, 1, 1, 1, GETDATE());
      SET IDENTITY_INSERT cat_mensajes_predeterminados OFF;
    `);
    console.log('Seeded cat_mensajes_predeterminados successfully.');
  } else {
    console.log('cat_mensajes_predeterminados already has rows.');
  }
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
