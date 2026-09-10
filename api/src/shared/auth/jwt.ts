import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { RolUsuario } from '@prisma/client';
import { env } from '../../config/env.js';

// 15 minutos, decisión ya tomada (ver README > Decisiones). No es
// configurable por variable de entorno a propósito: es un valor de
// seguridad, no de infraestructura, y hardcodearlo evita que alguien lo
// alargue "temporalmente" en producción sin que quede registrado en un commit.
const EXPIRACION_ACCESS_TOKEN = '15m';

export type PayloadAccessToken = {
  sub: string; // id del usuario
  rol: RolUsuario;
};

// jwt.verify() devuelve `string | JwtPayload` — no hay garantía en tiempo de
// compilación de que el payload decodificado tenga la forma que esperamos
// (alguien podría, en teoría, presentar un JWT válido firmado con otra
// intención). Se valida la forma con Zod antes de confiar en el contenido,
// en vez de hacer un cast directo.
const payloadSchema = z.object({
  sub: z.string().uuid(),
  rol: z.enum(['administrador', 'agente', 'supervisor']),
});

export function firmarAccessToken(payload: PayloadAccessToken): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: EXPIRACION_ACCESS_TOKEN });
}

/** Lanza si el token es inválido, expiró, o no tiene la forma esperada. */
export function verificarAccessToken(token: string): PayloadAccessToken {
  const decodificado = jwt.verify(token, env.JWT_SECRET);
  return payloadSchema.parse(decodificado);
}
