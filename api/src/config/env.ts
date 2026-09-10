import { config as cargarDotenv } from 'dotenv';
import { z } from 'zod';

// Solo tiene efecto fuera de Docker: dentro del contenedor no existe
// api/.env (excluido en .dockerignore) y las variables ya llegan puestas
// por docker-compose. dotenv nunca sobreescribe una variable que ya esté en
// process.env, así que esta llamada es segura en cualquier entorno —
// incluido CI, donde las variables se ponen directo en el workflow.
// `quiet: true` porque dotenv (desde la v17) imprime "tips" promocionales
// aleatorios en cada arranque — sin relación con este proyecto, no algo
// que deba aparecer en los logs de un servicio real.
cargarDotenv({ quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Sin default: un secreto de JWT con un valor conocido de antemano
  // invalidaría toda la autenticación. Se exige explícito en .env
  // (ver .env.example) para que el servicio no arranque sin uno propio.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Falla temprano y con mensaje claro: un servicio mal configurado no debe arrancar.
  console.error('Configuracion invalida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
