import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from './http-error.js';
import { logger } from './logger.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Ruta no encontrada' } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { message: 'Datos invalidos', details: err.flatten().fieldErrors },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { message: err.message, details: err.details },
    });
    return;
  }

  logger.error({ err }, 'Error no controlado');
  res.status(500).json({ error: { message: 'Error interno' } });
}
