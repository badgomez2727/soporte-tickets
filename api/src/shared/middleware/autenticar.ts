import type { NextFunction, Request, Response } from 'express';
import { verificarAccessToken } from '../auth/jwt.js';
import { prisma } from '../prisma.js';
import { HttpError } from '../http-error.js';

/**
 * Verifica la firma del access token Y, en cada petición, consulta que
 * usuarios.activo siga en true. Es lo que hace que bloquear a un usuario
 * surta efecto de inmediato en vez de esperar a que su token expire (hasta
 * 15 minutos) — ver el test "usuario bloqueado con token vigente" en
 * tests/auth.test.ts.
 *
 * Costo: una consulta a la base por petición autenticada. Mitigación
 * pensada pero NO implementada todavía (ver README > Decisiones): una
 * caché en memoria de `{ usuarioId: activo }` con TTL corto (segundos, no
 * minutos), invalidada explícitamente cuando se bloquea/desbloquea a
 * alguien. No se construye ahora porque agrega un estado más para razonar
 * (¿qué pasa si dos instancias del API corren en paralelo y una no se
 * entera del bloqueo?) sin que el volumen actual lo justifique.
 */
export async function autenticar(req: Request, _res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization;

  if (!encabezado?.startsWith('Bearer ')) {
    next(HttpError.unauthorized());
    return;
  }

  const token = encabezado.slice('Bearer '.length);

  try {
    const payload = verificarAccessToken(token);

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, rol: true, activo: true },
    });

    if (!usuario || !usuario.activo) {
      next(HttpError.unauthorized());
      return;
    }

    req.usuario = { id: usuario.id, rol: usuario.rol };
    next();
  } catch {
    // Firma inválida, token expirado, o payload con forma inesperada:
    // mismo error genérico en los tres casos — no hay razón para que el
    // cliente distinga cuál fue, en cualquier caso la acción es la misma
    // (volver a autenticarse).
    next(HttpError.unauthorized());
  }
}
