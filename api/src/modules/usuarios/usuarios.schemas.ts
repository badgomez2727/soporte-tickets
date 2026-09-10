import { z } from 'zod';

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(['administrador', 'agente', 'supervisor']),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
