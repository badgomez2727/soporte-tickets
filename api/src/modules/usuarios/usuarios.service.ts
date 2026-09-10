import type { RolUsuario, Usuario } from '@prisma/client';
import { prisma } from '../../shared/prisma.js';
import { hashearPassword } from '../../shared/auth/password.js';
import { revocarTodosLosTokens } from '../../shared/auth/refresh-token.js';
import { HttpError } from '../../shared/http-error.js';
import { aUsuarioPublico, type UsuarioPublico } from '../../shared/auth/usuario-publico.js';

async function requerirUsuario(id: string): Promise<Usuario> {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) {
    throw HttpError.notFound('Usuario no encontrado');
  }
  return usuario;
}

export async function listar(): Promise<UsuarioPublico[]> {
  const usuarios = await prisma.usuario.findMany({ orderBy: { nombre: 'asc' } });
  return usuarios.map(aUsuarioPublico);
}

export async function obtener(id: string): Promise<UsuarioPublico> {
  return aUsuarioPublico(await requerirUsuario(id));
}

type DatosCrearUsuario = {
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
};

export async function crear(datos: DatosCrearUsuario): Promise<UsuarioPublico> {
  const existente = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existente) {
    throw HttpError.conflict('Ya existe un usuario con ese email');
  }

  const passwordHash = await hashearPassword(datos.password);
  const usuario = await prisma.usuario.create({
    data: { nombre: datos.nombre, email: datos.email, passwordHash, rol: datos.rol },
  });

  return aUsuarioPublico(usuario);
}

export async function bloquear(id: string): Promise<UsuarioPublico> {
  await requerirUsuario(id);
  const usuario = await prisma.usuario.update({ where: { id }, data: { activo: false } });

  // El chequeo de activo=true en cada petición (middleware `autenticar`) ya
  // vuelve inútil cualquier access token vigente de este usuario. Revocar
  // sus refresh tokens cierra el otro camino: que use uno para sacar un
  // access token nuevo cuando el actual expire.
  await revocarTodosLosTokens(id);

  return aUsuarioPublico(usuario);
}

export async function desbloquear(id: string): Promise<UsuarioPublico> {
  await requerirUsuario(id);
  const usuario = await prisma.usuario.update({ where: { id }, data: { activo: true } });
  return aUsuarioPublico(usuario);
}
