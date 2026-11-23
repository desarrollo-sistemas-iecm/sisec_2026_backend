// Catalogo model for SISEC CC 2027 — Consulta 100% a sisec_2027_dev
import { getNewPool } from '../config/db.js'

export const getCatalogosReportes = async () => {
  const pool = await getNewPool()

  const [sedes, delegaciones, cursos] = await Promise.all([
    pool.request().query(`
      SELECT id_distrito AS idsede, 'Distrito ' + CAST(distrito AS varchar) AS descripcion, id_distrito AS iddelegacion
      FROM cat_distritos
      WHERE status = 1
      ORDER BY distrito ASC
    `),
    pool.request().query(`
      SELECT id_demarcacion AS iddelegacion, demarcacion AS descripcion
      FROM cat_demarcacion
      WHERE status = 1
      ORDER BY id_demarcacion ASC
    `),
    pool.request().query(`
      SELECT 
        id_accion AS idcurso, 
        clave_accion,
        nombre_accion AS descripcion, 
        id_vertiente AS idtipo
      FROM cat_acciones
      WHERE status = 1
      ORDER BY id_accion ASC
    `)
  ])

  return {
    sedes: sedes.recordset,
    delegaciones: delegaciones.recordset,
    cursos: cursos.recordset,
    tiposPublico: []
  }
}
