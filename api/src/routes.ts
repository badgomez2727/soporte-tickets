import { Router } from 'express';
import { healthRoutes } from './modules/health/health.routes.js';

/**
 * Punto unico de registro de modulos. Cada modulo nuevo se monta aqui
 * y no se toca app.ts.
 */
export const routes = Router();

routes.use('/health', healthRoutes);
