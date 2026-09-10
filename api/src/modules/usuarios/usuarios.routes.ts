import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { autenticar } from '../../shared/middleware/autenticar.js';
import { autorizarRol } from '../../shared/middleware/autorizar-rol.js';
import {
  listarController,
  obtenerController,
  crearController,
  bloquearController,
  desbloquearController,
} from './usuarios.controller.js';

export const usuariosRoutes = Router();

// Toda la administración de usuarios es exclusiva del rol Administrador.
usuariosRoutes.use(autenticar, autorizarRol('administrador'));

usuariosRoutes.get('/', asyncHandler(listarController));
usuariosRoutes.get('/:id', asyncHandler(obtenerController));
usuariosRoutes.post('/', asyncHandler(crearController));
usuariosRoutes.patch('/:id/bloquear', asyncHandler(bloquearController));
usuariosRoutes.patch('/:id/desbloquear', asyncHandler(desbloquearController));
