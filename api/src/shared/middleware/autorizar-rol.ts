import type { NextFunction, Request, Response } from 'express';
import type { RolUsuario } from '@prisma/client';
import { HttpError } from '../http-error.js';

/**
 * Autorización por rol: quién puede llamar el endpoint. Se usa siempre
 * después de `autenticar` (necesita req.usuario ya cargado).
 *
 * Este es solo el primer nivel de los dos que pide el enunciado. El
 * segundo — autorización por propiedad del recurso, ej. un agente solo
 * puede actualizar tickets asignados a él — vive en el módulo de tickets,
 * porque depende de datos del recurso mismo (ticket.agenteId), no solo del
 * usuario autenticado. No se escribe aquí un middleware genérico para eso
 * todavía porque no hay ningún recurso real al que aplicarlo — sería
 * código sin un caso de uso concreto que lo pruebe.
 */
export function autorizarRol(...rolesPermitidos: RolUsuario[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) {
      // No debería ocurrir si este middleware se monta después de
      // `autenticar` — si se usa mal, que falle explícito y no como un
      // permiso silencioso.
      next(HttpError.unauthorized());
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      next(HttpError.forbidden());
      return;
    }

    next();
  };
}
