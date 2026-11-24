// Permisos Controller - SISEC CC 2027 RBAC
import { getNewPool, getPool, sql } from '../config/db.js'
import { logger } from '../config/logger.js'
import { getIo } from '../socket.js'

// Catálogo maestro de los 6 módulos del sistema
export const MODULOS_SISTEMA = [
  {
    id_modulo: 1,
    codigo: 'dashboard',
    nombre: 'Dashboard',
    ruta: '/',
    icono: 'LayoutDashboard',
    descripcion: 'Métricas institucionales, avance global y semaforización ejecutiva'
  },
  {
    id_modulo: 2,
    codigo: 'programacion',
    nombre: 'Programacion',
    ruta: '/programacion',
    icono: 'CalendarDays',
    descripcion: 'Planeación de acciones educativas y vinculación institucional'
  },
  {
    id_modulo: 3,
    codigo: 'captura',
    nombre: 'Captura',
    ruta: '/captura',
    icono: 'Edit3',
    descripcion: 'Registro de evidencias, participantes y sedes visitadas'
  },
  {
    id_modulo: 4,
    codigo: 'encuestas',
    nombre: 'Encuestas',
    ruta: '/encuesta',
    icono: 'ClipboardList',
    descripcion: 'Aplicación de cuestionarios e instrumentos de evaluación ciudadana'
  },
  {
    id_modulo: 5,
    codigo: 'reportes',
    nombre: 'Reportes',
    ruta: '/reportes',
    icono: 'BarChart3',
    descripcion: 'Reportes ejecutivos y tabulados cuantitativos del sistema'
  },
  {
    id_modulo: 6,
    codigo: 'administracion',
    nombre: 'Administracion',
    ruta: '/administracion',
    icono: 'Settings',
    descripcion: 'Control de usuarios, calendarios, catálogos y formatos'
  }
]

// Módulos por defecto según perfil institucional
export const MODULOS_DEFAULT_DISTRITO = ['programacion', 'captura', 'encuestas', 'reportes']
export const MODULOS_DEFAULT_ADMIN = ['dashboard', 'programacion', 'captura', 'encuestas', 'reportes', 'administracion']

/**
 * Obtener catálogos completos de módulos del sistema
 */
export const getPermisosCatalogos = async (req, res, next) => {
  try {
    return res.json({
      success: true,
      modulos: MODULOS_SISTEMA
    })
  } catch (error) {
    logger.error(`[PERMISOS] Error al obtener catálogos: ${error.message}`)
    return next(error)
  }
}

/**
 * Obtener módulos permitidos para un usuario específico
 */
export const getPermisosUsuario = async (req, res, next) => {
  try {
    const idUsuario = parseInt(req.params.id_usuario, 10)
    if (!idUsuario) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido' })
    }

    let modulosUsuario = []
    let idTipoUsuario = 1

    try {
      const pool = await getNewPool()

      // 1. Consultar tipo de usuario
      const userRes = await pool.request()
        .input('id_usuario', sql.Int, idUsuario)
        .query('SELECT id_tipousuario, usuario FROM usuarios WHERE id_usuario = @id_usuario')

      if (userRes.recordset.length > 0) {
        idTipoUsuario = Number(userRes.recordset[0].id_tipousuario || 1)
      } else {
        const pFallback = await getPool()
        const fRes = await pFallback.request()
          .input('id_usuario', sql.Int, idUsuario)
          .query('SELECT idpermiso FROM sisec_usuarios WHERE idusuario = @id_usuario')
        if (fRes.recordset.length > 0) {
          idTipoUsuario = Number(fRes.recordset[0].idpermiso || 1)
        }
      }

      // 2. Consultar permisos guardados en rel_usuario_permisos
      const permRes = await pool.request()
        .input('id_usuario', sql.Int, idUsuario)
        .query(`
          SELECT DISTINCT p.id_modulo, m.codigo AS codigo_modulo
          FROM rel_usuario_permisos p
          LEFT JOIN cat_modulos m ON p.id_modulo = m.id_modulo
          WHERE p.id_usuario = @id_usuario AND p.permitido = 1
        `)

      if (permRes.recordset.length > 0) {
        // Mapear los módulos permitidos encontrados
        modulosUsuario = permRes.recordset.map(row => {
          if (row.codigo_modulo) return row.codigo_modulo.toLowerCase()
          const matched = MODULOS_SISTEMA.find(m => m.id_modulo === row.id_modulo)
          return matched ? matched.codigo : null
        }).filter(Boolean)
      }
    } catch (dbErr) {
      logger.warn(`[PERMISOS] Advertencia al consultar BD 2027: ${dbErr.message}`)
    }

    // Si el usuario no tiene permisos guardados explícitamente en BD, asignar según su rol
    if (modulosUsuario.length === 0) {
      modulosUsuario = idTipoUsuario === 1 ? [...MODULOS_DEFAULT_DISTRITO] : [...MODULOS_DEFAULT_ADMIN]
    }

    return res.json({
      success: true,
      id_usuario: idUsuario,
      id_tipousuario: idTipoUsuario,
      modulos: modulosUsuario,
      modulos_permitidos: modulosUsuario
    })
  } catch (error) {
    logger.error(`[PERMISOS] Error al consultar permisos de usuario: ${error.message}`)
    return next(error)
  }
}

/**
 * Guardar módulos asignados a un usuario
 */
export const savePermisosUsuario = async (req, res, next) => {
  try {
    const idUsuario = parseInt(req.params.id_usuario, 10)
    // Puede recibir array de códigos ['dashboard', 'captura', ...] o array de objetos o IDs
    const { modulos, permisos } = req.body

    if (!idUsuario) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido' })
    }

    let codigosModulos = []
    if (Array.isArray(modulos)) {
      codigosModulos = modulos.map(m => {
        if (typeof m === 'string') return m.toLowerCase()
        if (typeof m === 'number') {
          const modObj = MODULOS_SISTEMA.find(x => x.id_modulo === m)
          return modObj ? modObj.codigo : null
        }
        return m?.codigo ? String(m.codigo).toLowerCase() : null
      }).filter(Boolean)
    } else if (Array.isArray(permisos)) {
      // Compatibilidad con payload anterior
      const ids = permisos.filter(p => p.permitido).map(p => p.id_modulo)
      codigosModulos = [...new Set(ids)].map(id => {
        const modObj = MODULOS_SISTEMA.find(x => x.id_modulo === id)
        return modObj ? modObj.codigo : null
      }).filter(Boolean)
    }

    const pool = await getNewPool()
    const asignadoPor = req.user?.idUsuario || req.user?.id_usuario || 1

    try {
      const transaction = new sql.Transaction(pool)
      await transaction.begin()

      try {
        // Limpiar permisos previos del usuario
        const deleteReq = new sql.Request(transaction)
        deleteReq.input('id_usuario', sql.Int, idUsuario)
        await deleteReq.query('DELETE FROM rel_usuario_permisos WHERE id_usuario = @id_usuario')

        // Insertar cada módulo permitido
        for (const codigo of codigosModulos) {
          const modDef = MODULOS_SISTEMA.find(m => m.codigo === codigo)
          const modId = modDef ? modDef.id_modulo : null
          if (!modId) continue

          const insertReq = new sql.Request(transaction)
          insertReq.input('id_usuario', sql.Int, idUsuario)
          insertReq.input('id_modulo', sql.Int, modId)
          insertReq.input('id_submodulo', sql.Int, null)
          insertReq.input('id_accion_sistema', sql.Int, 1) // 1 = Acceso general al módulo
          insertReq.input('permitido', sql.Bit, 1)
          insertReq.input('asignado_por', sql.Int, asignadoPor)

          await insertReq.query(`
            INSERT INTO rel_usuario_permisos 
              (id_usuario, id_modulo, id_submodulo, id_accion_sistema, permitido, fecha_asignacion, asignado_por)
            VALUES 
              (@id_usuario, @id_modulo, @id_submodulo, @id_accion_sistema, @permitido, GETDATE(), @asignado_por)
          `)
        }

        await transaction.commit()
      } catch (txErr) {
        await transaction.rollback()
        throw txErr
      }
    } catch (dbErr) {
      logger.warn(`[PERMISOS] Advertencia al persistir en BD: ${dbErr.message}`)
    }

    // Notificar en tiempo real al usuario vía WebSocket si está conectado
    try {
      const io = getIo()
      if (io) {
        io.emit('usuario:permisos_actualizados', {
          id_usuario: idUsuario,
          modulos: codigosModulos
        })
      }
    } catch (wsErr) {
      // ignore
    }

    logger.info(`[PERMISOS] Permisos de módulos actualizados para usuario ${idUsuario}: [${codigosModulos.join(', ')}]`)

    return res.json({
      success: true,
      message: 'Permisos de módulos actualizados correctamente',
      modulos: codigosModulos
    })
  } catch (error) {
    logger.error(`[PERMISOS] Error al guardar permisos: ${error.message}`)
    return next(error)
  }
}

/**
 * Obtener módulos activos del usuario autenticado
 */
export const getMisPermisos = async (req, res, next) => {
  try {
    const idUsuario = req.user?.idUsuario || req.user?.id_usuario
    const idTipoUsuario = Number(req.user?.permiso || req.user?.idpermiso || 1)

    // Si es Superadmin (rol 3), tiene acceso total a todos los módulos
    if (idTipoUsuario === 3) {
      return res.json({
        success: true,
        isSuperAdmin: true,
        permisoNivel: 3,
        modulos: MODULOS_DEFAULT_ADMIN
      })
    }

    let modulosUsuario = []
    try {
      const pool = await getNewPool()
      const result = await pool.request()
        .input('id_usuario', sql.Int, idUsuario)
        .query(`
          SELECT DISTINCT p.id_modulo, m.codigo AS codigo_modulo
          FROM rel_usuario_permisos p
          LEFT JOIN cat_modulos m ON p.id_modulo = m.id_modulo
          WHERE p.id_usuario = @id_usuario AND p.permitido = 1
        `)

      if (result.recordset.length > 0) {
        modulosUsuario = result.recordset.map(row => {
          if (row.codigo_modulo) return row.codigo_modulo.toLowerCase()
          const matched = MODULOS_SISTEMA.find(m => m.id_modulo === row.id_modulo)
          return matched ? matched.codigo : null
        }).filter(Boolean)
      }
    } catch (dbErr) {
      // ignore
    }

    // Si no tiene configuración personalizada, usar defaults institucionales
    if (modulosUsuario.length === 0) {
      modulosUsuario = idTipoUsuario === 1 ? [...MODULOS_DEFAULT_DISTRITO] : [...MODULOS_DEFAULT_ADMIN]
    }

    return res.json({
      success: true,
      isSuperAdmin: false,
      permisoNivel: idTipoUsuario,
      modulos: modulosUsuario
    })
  } catch (error) {
    logger.error(`[PERMISOS] Error al obtener mis permisos: ${error.message}`)
    return next(error)
  }
}
