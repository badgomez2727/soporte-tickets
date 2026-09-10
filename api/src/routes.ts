import { Router } from 'express';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usuariosRoutes } from './modules/usuarios/usuarios.routes.js';

/**
 * Punto unico de registro de modulos. Cada modulo nuevo se monta aqui
 * y no se toca app.ts.
 */
export const routes = Router();

routes.use('/health', healthRoutes);
routes.use('/auth', authRoutes);
routes.use('/usuarios', usuariosRoutes);
