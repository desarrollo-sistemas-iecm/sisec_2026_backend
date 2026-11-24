import fs from 'fs'
import path from 'path'
import { logger } from '../config/logger.js'
import { crearNotificacion } from '../models/notificacionModel.js'
import { registrarAuditoriaArchivo } from '../models/auditoriaModel.js'

// Resolución inteligente del directorio de formatos oficiales
export const getBasePath = () => {
  const envPath = process.env.FORMATOS_PATH || './uploads/temp/Archivos/2026/'
  let dir = path.resolve(envPath)
  if (!fs.existsSync(dir)) {
    const backendDir = path.resolve(process.cwd(), 'backend', envPath)
    if (fs.existsSync(backendDir)) dir = backendDir
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// Configuración por defecto de las 5 categorías institucionales y sus formatos oficiales
export const DEFAULT_CATEGORIAS_FORMATOS = [
  {
    id: 1,
    nombre: 'Servicio Social',
    tag: 'SS',
    activo: true,
    archivos: [
      { id: 101, nombre: 'Formato de registro', archivo: 'Anexo01_SS.docx', activo: true },
      { id: 102, nombre: 'Manifestación de no ser beneficiario/a de alguna beca que impida recibir el apoyo económico', archivo: 'Anexo02_SS.docx', activo: true },
      { id: 103, nombre: 'Formato de reporte de avance en el proceso de reclutamiento de prestadores y prestadoras de servicio social', archivo: 'Anexo03_SS.docx', activo: true },
      { id: 104, nombre: 'Formato para el reporte de bajas anticipadas y sustituciones de prestadores y prestadoras de servicio social', archivo: 'Anexo04_SS.docx', activo: true },
      { id: 105, nombre: 'Formato de reporte de la capacitación otorgada a las y los prestadores de servicio social', archivo: 'Anexo05_SS.docx', activo: true },
      { id: 106, nombre: 'Consideraciones generales para la coordinación de las actividades de las y los prestadores de servicio social', archivo: 'Anexo06_SS.docx', activo: true },
      { id: 107, nombre: 'Lista de asistencia de el/la prestador(a) de servicio social', archivo: 'Anexo07_SS.docx', activo: true },
      { id: 108, nombre: 'Formato para la solicitud de otorgamiento de apoyo económico a prestadores(as) de servicio social', archivo: 'Anexo08_SS.docx', activo: true },
      { id: 109, nombre: 'Formato para la solicitud de expedición de Oficio de liberación para prestadores(as) de servicio social', archivo: 'Anexo09_SS.docx', activo: true }
    ]
  },
  {
    id: 2,
    nombre: 'Acciones Educativas',
    tag: 'AE',
    activo: true,
    archivos: [
      { id: 201, nombre: 'Formato para el registro de asistentes a talleres de formación ciudadana e intervenciones educativas', archivo: 'Anexo01_AE.docx', activo: true },
      { id: 202, nombre: 'Formato para el registro del desarrollo de talleres de formación ciudadana e intervenciones educativas', archivo: 'Anexo02_AE.docx', activo: true },
      { id: 203, nombre: 'Encuesta de satisfacción', archivo: 'Anexo03_AE.docx', activo: true },
      { id: 204, nombre: 'Cédula de verificación de expediente físico o digital distrital', archivo: 'Anexo04_AE.docx', activo: true }
    ]
  },
  {
    id: 3,
    nombre: 'Ludoteca Cívica',
    tag: 'LUCI',
    activo: true,
    archivos: [
      { id: 301, nombre: 'Formato para la gestión de acciones educativas de la Ludoteca Cívica dirigidas a la comunidad educativa y otros públicos', archivo: 'luci.docx', activo: true }
    ]
  },
  {
    id: 4,
    nombre: 'Vínculo Institucional (Demarcaciones)',
    tag: 'DT',
    activo: true,
    archivos: [
      { id: 401, nombre: 'Modelo de Convenio', archivo: 'Anexo01_DT.docx', activo: true },
      { id: 402, nombre: 'Modelo de Programa Anual de Trabajo', archivo: 'Anexo02_DT.docx', activo: true },
      { id: 403, nombre: 'Procedimiento de vinculación', archivo: 'Anexo03_DT.docx', activo: true }
    ]
  },
  {
    id: 5,
    nombre: 'Lineamientos de Protección',
    tag: 'PROT',
    activo: true,
    archivos: [
      { id: 501, nombre: 'Carta de autorización expresa y cesión de derechos para madres y padres de familia', archivo: 'lineamientos1.docx', activo: true },
      { id: 502, nombre: 'Formato de autorización expresa de las niñas, niños y adolescentes', archivo: 'lineamientos2.docx', activo: true }
    ]
  }
]

// Carga y sincronización de la configuración persistente
export const loadFormatosConfig = () => {
  const basePath = getBasePath()
  const configPath = path.join(basePath, 'formatos_config.json')

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8')
      const parsed = JSON.parse(content)
      if (parsed && Array.isArray(parsed.categorias)) {
        return parsed
      }
    }
  } catch (err) {
    logger.warn('[FORMATOS] Error al leer formatos_config.json, usando defaults:', err.message)
  }

  // Si no existe o falló, inicializar con los defaults y guardar
  const initialConfig = { categorias: DEFAULT_CATEGORIAS_FORMATOS }
  try {
    fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), 'utf8')
  } catch (err) {
    logger.error('[FORMATOS] No se pudo guardar config inicial:', err.message)
  }
  return initialConfig
}

export const saveFormatosConfig = (config) => {
  const basePath = getBasePath()
  const configPath = path.join(basePath, 'formatos_config.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}

// Listar formatos para el panel administrativo (con categorías, estados y archivos en servidor)
export const listAdminFormatos = (req, res, next) => {
  try {
    const basePath = getBasePath()
    const files = fs.readdirSync(basePath)
      .filter(file => fs.statSync(path.join(basePath, file)).isFile())

    const config = loadFormatosConfig()

    return res.json({
      success: true,
      data: files,
      categorias: config.categorias || [],
      serverFiles: files
    })
  } catch (error) {
    return next(error)
  }
}

// Activar o desactivar una sección / categoría completa
export const toggleCategoria = async (req, res, next) => {
  try {
    const { id, activo } = req.body
    if (id === undefined) {
      return res.status(400).json({ success: false, message: 'ID de categoría requerido.' })
    }

    const config = loadFormatosConfig()
    const cat = config.categorias.find(c => Number(c.id) === Number(id))
    if (!cat) {
      return res.status(404).json({ success: false, message: 'Categoría no encontrada.' })
    }

    cat.activo = Boolean(activo)
    saveFormatosConfig(config)

    logger.info(`[FORMATOS] 🔀 Categoría "${cat.nombre}" ${cat.activo ? 'ACTIVADA' : 'DESACTIVADA'} por usuario ${req.user.idusuario}`)

    return res.json({
      success: true,
      message: `La sección "${cat.nombre}" fue ${cat.activo ? 'activada' : 'desactivada'} correctamente.`,
      data: cat
    })
  } catch (error) {
    return next(error)
  }
}

// Activar o desactivar un formato individual dentro de una sección
export const toggleFormato = async (req, res, next) => {
  try {
    const { categoriaId, archivo, activo } = req.body
    if (!categoriaId || !archivo) {
      return res.status(400).json({ success: false, message: 'categoriaId y archivo son requeridos.' })
    }

    const config = loadFormatosConfig()
    const cat = config.categorias.find(c => Number(c.id) === Number(categoriaId))
    if (!cat) {
      return res.status(404).json({ success: false, message: 'Categoría no encontrada.' })
    }

    const formato = (cat.archivos || []).find(f => f.archivo === archivo)
    if (!formato) {
      return res.status(404).json({ success: false, message: 'Formato no encontrado en la categoría.' })
    }

    formato.activo = Boolean(activo)
    saveFormatosConfig(config)

    logger.info(`[FORMATOS] 🔀 Formato "${formato.nombre}" (${archivo}) ${formato.activo ? 'ACTIVADO' : 'DESACTIVADO'} por usuario ${req.user.idusuario}`)

    return res.json({
      success: true,
      message: `El formato "${formato.nombre}" fue ${formato.activo ? 'activado' : 'desactivado'} correctamente.`,
      data: formato
    })
  } catch (error) {
    return next(error)
  }
}

// Subir y registrar un nuevo formato oficial en cualquier categoría
export const subirNuevoFormato = async (req, res, next) => {
  try {
    if (!req.files || !req.files.archivo || req.files.archivo.length === 0) {
      return res.status(400).json({ success: false, message: 'No se envió ningún archivo.' })
    }

    const file = req.files.archivo[0]
    const { categoriaId, nombre } = req.body

    if (!categoriaId || !nombre || !nombre.trim()) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      return res.status(400).json({ success: false, message: 'Debe especificar la categoría y el nombre descriptivo del formato.' })
    }

    const config = loadFormatosConfig()
    const cat = config.categorias.find(c => Number(c.id) === Number(categoriaId))
    if (!cat) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      return res.status(404).json({ success: false, message: 'Categoría no encontrada.' })
    }

    // Nombre seguro y extensión
    const ext = path.extname(file.originalname).toLowerCase()
    const validExtensions = ['.docx', '.doc', '.pdf', '.xlsx', '.xls']
    if (!validExtensions.includes(ext)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      return res.status(400).json({ success: false, message: 'Extensión no permitida. Solo se aceptan documentos .docx, .pdf o .xlsx' })
    }

    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_')
    let finalFileName = `${safeBase}${ext}`
    const basePath = getBasePath()
    let destPath = path.join(basePath, finalFileName)

    // Si ya existe con ese nombre, agregar timestamp
    if (fs.existsSync(destPath)) {
      finalFileName = `${safeBase}_${Date.now()}${ext}`
      destPath = path.join(basePath, finalFileName)
    }

    // Mover archivo
    fs.renameSync(file.path, destPath)

    // Registrar en la lista de archivos de la categoría
    if (!cat.archivos) cat.archivos = []
    const nuevoFormato = {
      id: Date.now(),
      nombre: nombre.trim(),
      archivo: finalFileName,
      activo: true,
      custom: true,
      fecha_creacion: new Date().toISOString()
    }
    cat.archivos.push(nuevoFormato)
    saveFormatosConfig(config)

    logger.info(`[FORMATOS] 📤 Nuevo formato añadido: "${nuevoFormato.nombre}" (${finalFileName}) en categoría "${cat.nombre}" por usuario ${req.user.idusuario}`)

    // Registrar en auditoría
    await registrarAuditoriaArchivo(req.user.idusuario, finalFileName, 'subir_nuevo')

    // Notificar a todos los distritos
    await crearNotificacion({
      tipo: 'archivo_formatos_actualizado',
      titulo: 'Nuevo formato oficial disponible',
      mensaje: `Se ha publicado el formato oficial "${nuevoFormato.nombre}" en la sección "${cat.nombre}".`,
      idsede_origen: req.user.idsede || 0,
      idsede_destino: 0,
      idusuario_destino: 0
    })

    return res.json({
      success: true,
      message: `Formato registrado y subido correctamente a "${cat.nombre}".`,
      data: nuevoFormato
    })
  } catch (error) {
    return next(error)
  }
}

// Reemplazar un archivo de formato existente
export const uploadAdminFormato = async (req, res, next) => {
  try {
    if (!req.files || !req.files.archivo || req.files.archivo.length === 0) {
      return res.status(400).json({ success: false, message: 'No se envió ningún archivo.' })
    }

    const file = req.files.archivo[0]
    const nombreArchivo = req.body.nombreArchivo || file.originalname

    const safeNameRegex = /^[a-zA-Z0-9_\-\.]+\.(docx|doc|pdf|xlsx|xls)$/i
    if (!safeNameRegex.test(nombreArchivo)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
      return res.status(400).json({ success: false, message: 'Nombre de archivo inválido. Extensiones permitidas: .docx, .doc, .pdf, .xlsx' })
    }

    const basePath = getBasePath()
    const destPath = path.join(basePath, nombreArchivo)

    // Mover de temp a destino
    fs.renameSync(file.path, destPath)

    logger.info(`[ACTION] 📝 Formato actualizado por admin: ${nombreArchivo} por usuario ${req.user.idusuario}`)

    await registrarAuditoriaArchivo(req.user.idusuario, nombreArchivo, 'reemplazar')

    await crearNotificacion({
      tipo: 'archivo_formatos_actualizado',
      titulo: 'Formato oficial actualizado',
      mensaje: `Se ha actualizado la plantilla oficial: ${nombreArchivo}.`,
      idsede_origen: req.user.idsede || 0,
      idsede_destino: 0,
      idusuario_destino: 0
    })

    return res.json({ success: true, message: 'Archivo actualizado correctamente.' })
  } catch (error) {
    return next(error)
  }
}

// Eliminar formato del servidor y de la categoría
export const deleteAdminFormato = async (req, res, next) => {
  try {
    const { archivo } = req.params

    const safeNameRegex = /^[a-zA-Z0-9_\-\.]+\.(docx|doc|pdf|xlsx|xls)$/i
    if (!safeNameRegex.test(archivo)) {
      return res.status(400).json({ success: false, message: 'Nombre de archivo inválido.' })
    }

    const basePath = getBasePath()
    const filePath = path.join(basePath, archivo)

    if (!filePath.startsWith(path.resolve(basePath))) {
      return res.status(403).json({ success: false, message: 'Acceso denegado.' })
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Si era un formato personalizado (custom), removerlo de la configuración
    const config = loadFormatosConfig()
    let changed = false
    config.categorias.forEach(cat => {
      const idx = (cat.archivos || []).findIndex(f => f.archivo === archivo && f.custom)
      if (idx !== -1) {
        cat.archivos.splice(idx, 1)
        changed = true
      }
    })
    if (changed) {
      saveFormatosConfig(config)
    }
    
    logger.info(`[ACTION] 🗑️ Formato eliminado por admin: ${archivo} por usuario ${req.user.idusuario}`)
    await registrarAuditoriaArchivo(req.user.idusuario, archivo, 'eliminar')

    return res.json({ success: true, message: 'Archivo eliminado correctamente.' })
  } catch (error) {
    return next(error)
  }
}
