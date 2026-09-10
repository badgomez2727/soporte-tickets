import type { Request, Response } from 'express';
import * as clientesService from './clientes.service.js';

export async function listarController(_req: Request, res: Response) {
  res.json(await clientesService.listar());
}
