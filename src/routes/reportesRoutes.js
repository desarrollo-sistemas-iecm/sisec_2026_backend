// Reportes routes for SISEC CC 2026 / 2027
import { Router } from 'express'
import { body } from 'express-validator'
import { auth } from '../middlewares/auth.js'
import { validateReporte } from '../middlewares/validate.js'
import { catalogosReportes, generarReporte, previewReporte } from '../controllers/reportesController.js'

const router = Router()

const TIPOS_VALIDOS = ['acciones_educativas', 'encuestas', 'historico', 'acciones', '101', '102', '103']

router.get('/catalogos', auth, catalogosReportes)

// Previsualización de reporte en formato JSON para la vista interactiva
router.post(
  '/preview',
  auth,
  [
    body('tipo').notEmpty().withMessage('Tipo de reporte requerido'),
    body('fechaInic').optional({ checkFalsy: true }).isDate().withMessage('Fecha inicial inválida'),
    body('fechaFin').optional({ checkFalsy: true }).isDate().withMessage('Fecha final inválida')
  ],
  validateReporte,
  previewReporte
)

// Generación y descarga directa en Excel (.xlsx)
router.post(
  '/generar',
  auth,
  [
    body('tipo').notEmpty().withMessage('Tipo de reporte requerido'),
    body('fechaInic').optional({ checkFalsy: true }).isDate().withMessage('Fecha inicial inválida'),
    body('fechaFin').optional({ checkFalsy: true }).isDate().withMessage('Fecha final inválida')
  ],
  validateReporte,
  generarReporte
)

export default router
