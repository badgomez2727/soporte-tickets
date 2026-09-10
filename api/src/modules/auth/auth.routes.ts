import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../shared/async-handler.js';
import { autenticar } from '../../shared/middleware/autenticar.js';
import { loginController, refreshController, logoutController, perfilController } from './auth.controller.js';

export const authRoutes = Router();

// Rate limit solo en login (pedido explícito, no en el resto del API):
// frena fuerza bruta de contraseñas por IP. 10 intentos cada 15 minutos es
// holgado para alguien que se equivoca un par de veces, y suficiente para
// frenar un intento automatizado.
const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, intente de nuevo más tarde' } },
});

authRoutes.post('/login', limitarLogin, asyncHandler(loginController));
authRoutes.post('/refresh', asyncHandler(refreshController));
authRoutes.post('/logout', asyncHandler(logoutController));
authRoutes.get('/perfil', autenticar, asyncHandler(perfilController));
