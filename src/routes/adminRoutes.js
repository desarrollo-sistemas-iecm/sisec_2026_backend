import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import multer from 'multer'
import { 
  listConfigFechas, 
  saveConfigFechas, 
  updateConfigFecha,
  deleteConfigFecha, 
  requestFechaExcepcion, 
  getManualConfig, 
  saveManualConfig, 
  getAlertaLoginConfig, 
  saveAlertaLoginConfig, 
  getUltimaActualizacionConfig, 
  saveUltimaActualizacionConfig, 
  getSistemaCierreConfig,
  saveSistemaCierreConfig,
  listCursosAdmin, 
  createCursoAdmin, 
  updateCursoColor, 
  updateVertienteColor 
} from '../controllers/adminController.js'
import { getUsuarios, postUsuario, putUsuario, delUsuario, desconectarUsuarioEndpoint } from '../controllers/usuariosController.js'
import { getArchivosTree, deleteArchivo, replaceArchivo, downloadFolderZip } from '../controllers/archivosController.js'
import {
  listAdminFormatos,
  uploadAdminFormato,
  deleteAdminFormato,
  toggleCategoria,
  toggleFormato,
  subirNuevoFormato
} from '../controllers/adminFormatosController.js'
import { getPermisosCatalogos, getPermisosUsuario, savePermisosUsuario, getMisPermisos } from '../controllers/permisosController.js'
import {
  getTelegramConfigEndpoint,
  putTelegramConfigEndpoint,
  postTelegramTestEndpoint
} from '../controllers/telegramAdminController.js'
import {
  getMetasEndpoint,
  postMetaEndpoint,
  putMetaEndpoint,
  getRecordatoriosEndpoint,
  postRecordatorioEndpoint,
  postDispararRecordatorioEndpoint,
  getMetasDashboardStatsEndpoint
} from '../controllers/metasController.js'

const upload = multer({ dest: 'uploads/temp/' })

const router = Router()

// Middleware para permitir tanto Administrador (2) como Super Admin (3)
const isSuperAdmin = (req, res, next) => {
  if (req.user && Number(req.user.permiso || req.user.idpermiso) >= 2) {
    return next()
  }
  return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere nivel de Administrador.' })
}

// Middleware exclusivo para Super Admin (idpermiso = 3)
const onlySuperAdmin = (req, res, next) => {
  if (req.user && Number(req.user.permiso || req.user.idpermiso) === 3) {
    return next()
  }
  return res.status(403).json({ success: false, message: 'Acceso denegado. Se requiere nivel de Super Administrador.' })
}

// Rutas de Restricciones
router.get('/restricciones', auth, listConfigFechas)
router.post('/restricciones', auth, isSuperAdmin, saveConfigFechas)
router.put('/restricciones/:id', auth, isSuperAdmin, updateConfigFecha)
router.delete('/restricciones/:id', auth, isSuperAdmin, deleteConfigFecha)
router.post('/restricciones/solicitar', auth, requestFechaExcepcion)

// Configuración del Manual de Usuario
router.get('/manual-config', auth, getManualConfig)
router.post('/manual-config', auth, onlySuperAdmin, saveManualConfig)

// Configuración de la Alerta del Manual en el Login
router.get('/alerta-login-config', auth, getAlertaLoginConfig)
router.post('/alerta-login-config', auth, onlySuperAdmin, saveAlertaLoginConfig)

// Configuración de la Última Actualización del Código
router.get('/ultima-actualizacion-config', getUltimaActualizacionConfig)
router.post('/ultima-actualizacion-config', auth, onlySuperAdmin, saveUltimaActualizacionConfig)

// Configuración de Cierre y Apertura Programada del Sistema (Inicio de Sesión) (Solo Super Administrador)
router.get('/config-fechas/sistema-cierre', auth, onlySuperAdmin, getSistemaCierreConfig)
router.post('/config-fechas/sistema-cierre', auth, onlySuperAdmin, saveSistemaCierreConfig)




// Rutas de Usuarios
router.get('/usuarios', auth, isSuperAdmin, getUsuarios)
router.post('/usuarios', auth, onlySuperAdmin, postUsuario)
router.put('/usuarios/:id', auth, isSuperAdmin, putUsuario)
router.delete('/usuarios/:id', auth, onlySuperAdmin, delUsuario)
router.put('/usuarios/:id/desconectar', auth, onlySuperAdmin, desconectarUsuarioEndpoint)

// Rutas de Archivos
router.get('/archivos', auth, isSuperAdmin, getArchivosTree)
router.get('/archivos/zip', auth, isSuperAdmin, downloadFolderZip)
router.delete('/archivos', auth, isSuperAdmin, deleteArchivo)
router.post('/archivos/replace', auth, isSuperAdmin, upload.fields([{ name: 'archivo', maxCount: 1 }]), replaceArchivo)

// Solicitud de cambio de archivo por el operador
router.post('/archivos/solicitar', auth, upload.fields([{ name: 'archivo', maxCount: 1 }]), async (req, res, next) => {
  try {
    const file = req.files?.archivo?.[0]
    if (!file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' })
    }
    
    // Aquí el archivo se queda en uploads/temp/
    // Enviamos notificación al Super Admin
    const { crearNotificacion } = await import('../models/notificacionModel.js')
    await crearNotificacion({
      tipo: 'solicitud_archivo',
      titulo: `Solicitud de cambio de archivo: Dtto ${req.user.idsede}`,
      mensaje: `El Distrito ${req.user.idsede} solicita reemplazar un archivo. Archivo temporal: ${file.filename}`,
      idsede_origen: req.user.idsede,
      idsede_destino: 0,
      idusuario_destino: 0
    })

    return res.json({ success: true, message: 'Solicitud enviada' })
  } catch (error) {
    return next(error)
  }
})

// Rutas de Formatos (Solo Super Admin)
router.get('/formatos', auth, onlySuperAdmin, listAdminFormatos)
router.post('/formatos/subir', auth, onlySuperAdmin, upload.fields([{ name: 'archivo', maxCount: 1 }]), uploadAdminFormato)
router.post('/formatos/nuevo', auth, onlySuperAdmin, upload.fields([{ name: 'archivo', maxCount: 1 }]), subirNuevoFormato)
router.put('/formatos/toggle-categoria', auth, onlySuperAdmin, toggleCategoria)
router.put('/formatos/toggle-formato', auth, onlySuperAdmin, toggleFormato)
router.delete('/formatos/:archivo', auth, onlySuperAdmin, deleteAdminFormato)

// Rutas de Catálogo de Cursos (Admin)
router.get('/cursos', auth, isSuperAdmin, listCursosAdmin)
router.post('/cursos', auth, isSuperAdmin, createCursoAdmin)
router.put('/cursos/:id/color', auth, isSuperAdmin, updateCursoColor)
router.put('/vertientes/:id/color', auth, isSuperAdmin, updateVertienteColor)

// Rutas de Gestión de Permisos Granulares (RBAC 2027)
router.get('/permisos/catalogos', auth, isSuperAdmin, getPermisosCatalogos)
router.get('/permisos/usuario/:id_usuario', auth, onlySuperAdmin, getPermisosUsuario)
router.post('/permisos/usuario/:id_usuario', auth, onlySuperAdmin, savePermisosUsuario)
router.get('/permisos/mis-permisos', auth, getMisPermisos)

// Rutas de Configuración de Notificaciones Telegram (Solo Super Admin)
router.get('/telegram-config', auth, onlySuperAdmin, getTelegramConfigEndpoint)
router.put('/telegram-config', auth, onlySuperAdmin, putTelegramConfigEndpoint)
router.post('/telegram-test', auth, onlySuperAdmin, postTelegramTestEndpoint)

// Rutas de Metas Anuales Institucionales y Recordatorios (Admin y Super Admin)
router.get('/metas', auth, isSuperAdmin, getMetasEndpoint)
router.post('/metas', auth, isSuperAdmin, postMetaEndpoint)
router.put('/metas/:id', auth, isSuperAdmin, putMetaEndpoint)
router.get('/metas/dashboard', auth, getMetasDashboardStatsEndpoint)

router.get('/recordatorios', auth, isSuperAdmin, getRecordatoriosEndpoint)
router.post('/recordatorios', auth, isSuperAdmin, postRecordatorioEndpoint)
router.post('/recordatorios/:id/disparar', auth, isSuperAdmin, postDispararRecordatorioEndpoint)

export default router
