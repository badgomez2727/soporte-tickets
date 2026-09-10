import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../prisma.js';

// 7 días, decisión ya tomada (ver README > Decisiones).
const DURACION_REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * El refresh token es un string aleatorio opaco (256 bits de entropía), NO
 * un JWT. No necesita firma ni payload: su única función es ser un secreto
 * que se puede buscar y revocar en la base. Un JWT aquí solo agregaría una
 * verificación de firma redundante, porque de todas formas hay que consultar
 * la base para rotar/revocar.
 */
function generarTokenOpaco(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Se guarda el hash, nunca el token en texto plano — si la base se filtra,
 * los refresh tokens no quedan directamente utilizables. SHA-256 (rápido)
 * y no argon2 (lento) a propósito: argon2 existe para protegerse de fuerza
 * bruta sobre secretos de baja entropía como una contraseña humana; este
 * token ya tiene 256 bits aleatorios, fuerza bruta no es un vector viable
 * aquí, y usar un hash lento solo penalizaría cada refresh sin ganar nada.
 */
function hashearToken(tokenPlano: string): string {
  return createHash('sha256').update(tokenPlano).digest('hex');
}

/** Crea una sesión de refresh nueva para el usuario y devuelve el token en texto plano (única vez que existe fuera de la base). */
export async function crearTokenRefresco(usuarioId: string): Promise<string> {
  const tokenPlano = generarTokenOpaco();

  await prisma.tokenRefresco.create({
    data: {
      usuarioId,
      tokenHash: hashearToken(tokenPlano),
      fechaExpiracion: new Date(Date.now() + DURACION_REFRESH_TOKEN_MS),
    },
  });

  return tokenPlano;
}

export type ResultadoRotacion =
  | { ok: true; usuarioId: string; tokenPlano: string }
  | { ok: false; motivo: 'invalido' | 'reuso_detectado' };

/**
 * Rotación: el token presentado se invalida y se devuelve uno nuevo.
 * Detección de reuso: si el hash corresponde a un token YA revocado (ya sea
 * porque se rotó antes, se cerró sesión, o se bloqueó al usuario), es señal
 * de que alguien más tiene ese refresh token — se revocan todas las
 * sesiones del usuario como respuesta defensiva, no solo esta.
 */
export async function rotarTokenRefresco(tokenPlano: string): Promise<ResultadoRotacion> {
  const tokenHash = hashearToken(tokenPlano);
  const registro = await prisma.tokenRefresco.findUnique({ where: { tokenHash } });

  if (!registro) {
    return { ok: false, motivo: 'invalido' };
  }

  if (registro.fechaRevocacion !== null) {
    await revocarTodosLosTokens(registro.usuarioId);
    return { ok: false, motivo: 'reuso_detectado' };
  }

  if (registro.fechaExpiracion < new Date()) {
    return { ok: false, motivo: 'invalido' };
  }

  const nuevoTokenPlano = generarTokenOpaco();

  // Ambas escrituras juntas: si una falla, la otra no debe quedar aplicada
  // (mismo motivo que agenteId + historial_asignaciones en el módulo de tickets).
  await prisma.$transaction([
    prisma.tokenRefresco.update({
      where: { id: registro.id },
      data: { fechaRevocacion: new Date() },
    }),
    prisma.tokenRefresco.create({
      data: {
        usuarioId: registro.usuarioId,
        tokenHash: hashearToken(nuevoTokenPlano),
        fechaExpiracion: new Date(Date.now() + DURACION_REFRESH_TOKEN_MS),
      },
    }),
  ]);

  return { ok: true, usuarioId: registro.usuarioId, tokenPlano: nuevoTokenPlano };
}

/** Logout: revoca únicamente el token presentado. No falla si ya no existe o ya estaba revocado. */
export async function revocarToken(tokenPlano: string): Promise<void> {
  const tokenHash = hashearToken(tokenPlano);
  await prisma.tokenRefresco.updateMany({
    where: { tokenHash, fechaRevocacion: null },
    data: { fechaRevocacion: new Date() },
  });
}

/** Se usa al bloquear un usuario (y como respuesta a un reuso detectado). */
export async function revocarTodosLosTokens(usuarioId: string): Promise<void> {
  await prisma.tokenRefresco.updateMany({
    where: { usuarioId, fechaRevocacion: null },
    data: { fechaRevocacion: new Date() },
  });
}
