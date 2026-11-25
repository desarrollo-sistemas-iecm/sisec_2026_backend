// Catálogos 2027 para SISECyCC — Consulta 100% a sisec_2027_dev
import { getNewPool } from '../config/db.js'

// Grupos de edad oficiales 2027
export const GRUPOS_EDAD_BASE = [
  { id_grupo: 1, clave: 'G1', descripcion: 'Primera infancia (0 - 5 años)', min: 0, max: 5 },
  { id_grupo: 2, clave: 'G2', descripcion: 'Niñez (6 - 11 años)', min: 6, max: 11 },
  { id_grupo: 3, clave: 'G3', descripcion: 'Adolescencia (12 - 17 años)', min: 12, max: 17 },
  { id_grupo: 4, clave: 'G4', descripcion: 'Jóvenes (18 - 29 años)', min: 18, max: 29 },
  { id_grupo: 5, clave: 'G5', descripcion: 'Personas adultas (30 - 59 años)', min: 30, max: 59 },
  { id_grupo: 6, clave: 'G6', descripcion: 'Personas mayores (60 años en adelante)', min: 60, max: 120 }
]

export const getCatalogosProgramacion2027 = async () => {
  const pool = await getNewPool()

  const [accionesRes, vertientesRes, demarcacionesRes, tiposInstitucionRes, estadosRes, generosRes] = await Promise.all([
    pool.request().query(`
      SELECT a.id_accion, a.clave_accion, a.nombre_accion, a.id_vertiente, a.color, v.vertiente, v.color AS color_vertiente
      FROM cat_acciones a
      INNER JOIN cat_vertientes v ON a.id_vertiente = v.id_vertiente
      WHERE a.status = 1
      ORDER BY a.id_accion ASC
    `),
    pool.request().query(`
      SELECT id_vertiente, vertiente, color 
      FROM cat_vertientes 
      WHERE status = 1 
      ORDER BY id_vertiente ASC
    `),
    pool.request().query(`
      SELECT id_demarcacion, demarcacion 
      FROM cat_demarcacion 
      WHERE status = 1 
      ORDER BY id_demarcacion ASC
    `),
    pool.request().query(`
      SELECT id_tipo_institucion, descripcion 
      FROM cat_tipo_institucion 
      WHERE status = 1 
      ORDER BY id_tipo_institucion ASC
    `),
    pool.request().query(`
      SELECT id_estado, estado_accion 
      FROM estados 
      WHERE status = 1 
      ORDER BY id_estado ASC
    `),
    pool.request().query(`
      SELECT id_genero, genero 
      FROM cat_generos 
      WHERE status = 1 
      ORDER BY id_genero ASC
    `)
  ])

  return {
    acciones: accionesRes.recordset,
    vertientes: vertientesRes.recordset,
    demarcaciones: demarcacionesRes.recordset,
    tiposInstitucion: tiposInstitucionRes.recordset,
    estados: estadosRes.recordset,
    generos: generosRes.recordset,
    gruposEdad: GRUPOS_EDAD_BASE
  }
}
