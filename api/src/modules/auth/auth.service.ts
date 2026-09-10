import { prisma } from '../../shared/prisma.js';
import { verificarPassword } from '../../shared/auth/password.js';
import { firmarAccessToken } from '../../shared/auth/jwt.js';
import { crearTokenRefresco, rotarTokenRefresco, revocarToken } from '../../shared/auth/refresh-token.js';
import { HttpError } from '../../shared/http-error.js';
import { aUsuarioPublico, type UsuarioPublico } from '../../shared/auth/usuario-publico.js';

// Mismo mensaje para email inexistente, contraseña incorrecta o usuario
// bloqueado: evita que alguien use el login para averiguar qué emails
// existen o si una cuenta puntual está bloqueada.
const ERROR_LOGIN = 'Credenciales inválidas';

// Hash señuelo precalculado (ver docs/uso-ia.md y README > Decisiones): se
// verifica contra este hash cuando el email no existe, para que responder
// "no existe" tome un tiempo similar a responder "contraseña incorrecta".
// Sin esto, aunque el mensaje sea igual, el TIEMPO de respuesta distinto
// (saltarse argon2 vs. correrlo) sigue permitiendo enumerar emails.
const HASH_SENUELO =
  '$argon2id$v=19$m=65536,p=4,t=3$JHE+ouVFC+c9BC7FVPVk3w$5rtV82rMHF9agojvvEE5ftTvGoZkKYCKx1jaoBFUj1E';

export type SesionIniciada = {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioPublico;
};

export async function login(email: string, passwordPlano: string): Promise<SesionIniciada> {
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  const passwordValida = await verificarPassword(usuario?.passwordHash ?? HASH_SENUELO, passwordPlano);

  if (!usuario || !usuario.activo || !passwordValida) {
    throw HttpError.unauthorized(ERROR_LOGIN);
  }

  const accessToken = firmarAccessToken({ sub: usuario.id, rol: usuario.rol });
  const refreshToken = await crearTokenRefresco(usuario.id);

  return { accessToken, refreshToken, usuario: aUsuarioPublico(usuario) };
}

export type SesionRenovada = {
  accessToken: string;
  refreshToken: string;
};

export async function refrescar(tokenPlano: string): Promise<SesionRenovada> {
  const resultado = await rotarTokenRefresco(tokenPlano);

  if (!resultado.ok) {
    throw HttpError.unauthorized('Refresh token inválido');
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: resultado.usuarioId } });

  if (!usuario || !usuario.activo) {
    throw HttpError.unauthorized('Refresh token inválido');
  }

  const accessToken = firmarAccessToken({ sub: usuario.id, rol: usuario.rol });

  return { accessToken, refreshToken: resultado.tokenPlano };
}

export async function logout(tokenPlano: string): Promise<void> {
  await revocarToken(tokenPlano);
}
