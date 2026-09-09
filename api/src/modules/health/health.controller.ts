import type { Request, Response } from 'express';
import { checkReadiness } from './health.service.js';

// Liveness: responde si el proceso esta vivo. No toca dependencias externas.
export function live(_req: Request, res: Response) {
  res.json({ status: 'ok', uptime: process.uptime() });
}

// Readiness: responde si el servicio puede atender trafico real.
export async function ready(_req: Request, res: Response) {
  const result = await checkReadiness();
  res.status(result.database === 'up' ? 200 : 503).json(result);
}
