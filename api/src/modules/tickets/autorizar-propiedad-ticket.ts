import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../shared/prisma.js';
import { HttpError } from '../../shared/http-error.js';

/**
 * Segundo nivel de autorización, anunciado como pendiente en el módulo de
 * auth (ver README): por propiedad del recurso, no por rol. Administrador y
 * Supervisor operan sobre cualquier ticket; un Agente solo sobre los que
 * tiene asignados (ticket.agenteId === req.usuario.id).
 *
 * Vive en el módulo de tickets, no en shared/middleware, porque depende de
 * un dato del recurso mismo (agenteId), no solo del usuario autenticado.
 */
export async function autorizarPropiedadTicket(req: Request, _res: Response, next: NextFunction) {
  if (!req.usuario) {
    next(HttpError.unauthorized());
    return;
  }

  if (req.usuario.rol !== 'agente') {
    next();
    return;
  }

  const id = req.params.id;
  if (!id) {
    next(HttpError.badRequest('Falta el id del ticket'));
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { agenteId: true } });

  if (!ticket) {
    next(HttpError.notFound('Ticket no encontrado'));
    return;
  }

  if (ticket.agenteId !== req.usuario.id) {
    next(HttpError.forbidden('Solo puede operar sobre tickets asignados a usted'));
    return;
  }

  next();
}
