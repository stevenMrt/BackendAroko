// src/routes/devoluciones.routes.js

import { Router } from 'express';
import {
  listarDevoluciones,
  obtenerDevolucion,
  crearDevolucion,
  actualizarDevolucion,
  eliminarDevolucion,
} from '../controllers/devoluciones.controller.js';
import { verificarToken, verificarRol } from '../middleware/auth.middleware.js';

const router = Router();

router.use(verificarToken, verificarRol('Administrador', 'Repartidor'));

router.get('/',       listarDevoluciones);   // ?search=&estado=
router.get('/:id',    obtenerDevolucion);
router.post('/',      crearDevolucion);
router.put('/:id',    actualizarDevolucion);
router.delete('/:id', eliminarDevolucion);

export default router;
