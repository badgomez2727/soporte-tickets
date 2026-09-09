import cors from 'cors';
import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { routes } from './routes.js';
import { errorHandler, notFoundHandler } from './shared/error-handler.js';
import { logger } from './shared/logger.js';

/**
 * La app se construye aparte del servidor para que las pruebas la levanten
 * en memoria con supertest, sin abrir un puerto.
 */
export function createApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
