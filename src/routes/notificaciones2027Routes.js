// Rutas de Notificaciones y Mensajes Predeterminados 2027
import { Router } from 'express'
import { auth, isSuperAdmin } from '../middlewares/auth.js'
import {
  getMensajesPredeterminadosEndpoint,
  postMensajePredeterminadoEndpoint,
  postEnviarNotificacionEndpoint,
  getNotificacionesEndpoint,
  postAtenderNotificacionEndpoint
} from '../controllers/notificaciones2027Controller.js'

const router = Router()

router.get('/mensajes-predeterminados', auth, getMensajesPredeterminadosEndpoint)
router.post('/mensajes-predeterminados', auth, isSuperAdmin, postMensajePredeterminadoEndpoint)
router.post('/enviar', auth, postEnviarNotificacionEndpoint)
router.get('/', auth, getNotificacionesEndpoint)
router.put('/:id/atender', auth, postAtenderNotificacionEndpoint)

export default router
