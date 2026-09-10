import type { Usuario } from '@prisma/client';

export type UsuarioPublico = Omit<Usuario, 'passwordHash'>;

/**
 * Único punto por donde un Usuario sale del API. Centralizar esto en una
 * función (en vez de recordar excluir passwordHash a mano en cada
 * controlador que devuelve un usuario) es lo que garantiza que nunca se
 * filtre, aunque se agreguen más endpoints que devuelvan usuarios después.
 */
export function aUsuarioPublico(usuario: Usuario): UsuarioPublico {
  const { passwordHash: _passwordHash, ...resto } = usuario;
  return resto;
}
