import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`API escuchando en el puerto ${env.PORT}`);
});

// Apagado ordenado: deja de recibir conexiones antes de morir.
const shutdown = (signal: string) => {
  logger.info(`${signal} recibido, cerrando servidor`);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
