// API routes index for SISEC CC 2026
import { Router } from 'express'
import authRoutes from './authRoutes.js'
import formatosRoutes from './formatosRoutes.js'
import programacionRoutes from './programacionRoutes.js'
import cursosRoutes from './cursosRoutes.js'
import actividadesRoutes from './actividadesRoutes.js'
import encuestasRoutes from './encuestasRoutes.js'
import reportesRoutes from './reportesRoutes.js'
import uploadsRoutes from './uploadsRoutes.js'
import notificacionesRoutes from './notificacionesRoutes.js'
import adminRoutes from './adminRoutes.js'
import programacion2027Routes from './programacion2027Routes.js'
import captura2027Routes from './captura2027Routes.js'
import notificaciones2027Routes from './notificaciones2027Routes.js'

const router = Router()

router.use('/auth', authRoutes)
router.use('/formatos', formatosRoutes)
router.use('/programacion', programacionRoutes)
router.use('/cursos', cursosRoutes)
router.use('/actividades', actividadesRoutes)
router.use('/encuestas', encuestasRoutes)
router.use('/reportes', reportesRoutes)
router.use('/uploads', uploadsRoutes)
router.use('/notificaciones', notificacionesRoutes)
router.use('/admin', adminRoutes)

// Rutas 2027
router.use('/programacion-2027', programacion2027Routes)
router.use('/captura-2027', captura2027Routes)
router.use('/notificaciones-2027', notificaciones2027Routes)

export default router
