import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  // No se valida complejidad acá: login no es el lugar para eso (el error
  // "credenciales inválidas" ya cubre cualquier password incorrecta). Las
  // reglas de complejidad, si las hay, van en la creación de usuarios.
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
