import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { autenticar } from '../../shared/middleware/autenticar.js';
import { autorizarRol } from '../../shared/middleware/autorizar-rol.js';
import {
  listarController,
  listarAgentesController,
  obtenerController,
  crearController,
  bloquearController,
  desbloquearController,
} from './usuarios.controller.js';

export const usuariosRoutes = Router();

// Excepción a propósito, montada ANTES de la puerta de Administrador de
// abajo: cualquier rol autenticado puede pedir la lista de agentes (la
// necesitan el formulario de creación de tickets y el de reasignación).
// No es administración de usuarios, es solo un selector — ver
// usuarios.service.ts > listarAgentes.
usuariosRoutes.get('/agentes', autenticar, asyncHandler(listarAgentesController));

// El resto de la administración de usuarios es exclusiva del rol Administrador.
usuariosRoutes.use(autenticar, autorizarRol('administrador'));

usuariosRoutes.get('/', asyncHandler(listarController));
usuariosRoutes.get('/:id', asyncHandler(obtenerController));
usuariosRoutes.post('/', asyncHandler(crearController));
usuariosRoutes.patch('/:id/bloquear', asyncHandler(bloquearController));
usuariosRoutes.patch('/:id/desbloquear', asyncHandler(desbloquearController));
