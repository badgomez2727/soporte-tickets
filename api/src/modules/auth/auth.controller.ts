import type { Request, Response } from 'express';
import { loginSchema, refreshSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { prisma } from '../../shared/prisma.js';
import { HttpError } from '../../shared/http-error.js';
import { aUsuarioPublico } from '../../shared/auth/usuario-publico.js';

export async function loginController(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const sesion = await authService.login(email, password);
  res.json(sesion);
}

export async function refreshController(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const sesion = await authService.refrescar(refreshToken);
  res.json(sesion);
}

export async function logoutController(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).send();
}

export async function perfilController(req: Request, res: Response) {
  // El middleware `autenticar` ya garantiza req.usuario si se llegó hasta
  // acá; se valida de nuevo igual, en vez de un cast, por si algún día esta
  // ruta se monta sin el middleware por error.
  if (!req.usuario) {
    throw HttpError.unauthorized();
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!usuario) {
    throw HttpError.notFound();
  }

  res.json(aUsuarioPublico(usuario));
}
