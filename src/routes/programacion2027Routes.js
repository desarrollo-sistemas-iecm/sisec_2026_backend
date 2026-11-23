// Rutas de Programación 2027
import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import {
  getCatalogos2027Endpoint,
  postProgramacion2027Endpoint,
  getAccionesDistritoEndpoint,
  getAccionesAdminEndpoint,
  reprogramarAccionEndpoint,
  cancelarAccionEndpoint
} from '../controllers/programacion2027Controller.js'

const router = Router()

router.get('/catalogos', auth, getCatalogos2027Endpoint)
router.post('/', auth, postProgramacion2027Endpoint)
router.get('/distrito', auth, getAccionesDistritoEndpoint)
router.get('/admin/acciones', auth, getAccionesAdminEndpoint)
router.put('/:id/reprogramar', auth, reprogramarAccionEndpoint)
router.put('/:id/cancelar', auth, cancelarAccionEndpoint)

export default router
