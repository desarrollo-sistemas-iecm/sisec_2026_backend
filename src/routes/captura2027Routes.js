// Rutas de Captura, Evidencias y Encuestas 2027
import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { uploadEvidencias2027 } from '../services/fileUpload2027.js'
import {
  getCapturaDetailEndpoint,
  postGuardarCapturaEndpoint,
  postFinalizarAccionEndpoint,
  postEncuestaAccionEndpoint,
  getEncuestasAccionEndpoint,
  getArchivoCapturaEndpoint
} from '../controllers/captura2027Controller.js'

const router = Router()

router.get('/:id/detalle', auth, getCapturaDetailEndpoint)
router.get('/:id/archivo/:tipo', auth, getArchivoCapturaEndpoint)

// Guardar información y primeros 3 archivos (límite 10 MB cada uno)
router.post(
  '/:id/guardar',
  auth,
  uploadEvidencias2027.fields([
    { name: 'formato_registro_accion_pdf', maxCount: 1 },
    { name: 'formato_asistencia_accion_pdf', maxCount: 1 },
    { name: 'evidencia_fotografia', maxCount: 1 }
  ]),
  postGuardarCapturaEndpoint
)

// Subir 4.° archivo (Encuestas consolidadas hasta 20 MB) y Finalizar la Acción
router.post(
  '/:id/finalizar',
  auth,
  uploadEvidencias2027.fields([
    { name: 'encuesta_satisfaccion_pdf', maxCount: 1 }
  ]),
  postFinalizarAccionEndpoint
)

// Subflujo de Encuestas (1 Acción : N Encuestas)
router.post('/:id/encuestas', auth, postEncuestaAccionEndpoint)
router.get('/:id/encuestas', auth, getEncuestasAccionEndpoint)

export default router
