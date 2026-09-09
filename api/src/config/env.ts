import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Falla temprano y con mensaje claro: un servicio mal configurado no debe arrancar.
  console.error('Configuracion invalida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
