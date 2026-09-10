import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { autenticar } from '../../shared/middleware/autenticar.js';
import { listarController } from './clientes.controller.js';

export const clientesRoutes = Router();

clientesRoutes.use(autenticar);
clientesRoutes.get('/', asyncHandler(listarController));
