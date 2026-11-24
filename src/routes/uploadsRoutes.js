// Uploads routes for SISEC CC
import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { descargarArchivo, descargarManual, descargarArchivoGenerico } from '../controllers/uploadsController.js'

const router = Router()

router.get('/manual/descargar', auth, descargarManual)
router.get('/{*filepath}', auth, descargarArchivoGenerico)
router.get('/:carpeta/:sede/:archivo', auth, descargarArchivo)

export default router
