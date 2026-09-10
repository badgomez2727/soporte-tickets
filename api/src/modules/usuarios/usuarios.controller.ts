import type { Request, Response } from 'express';
import { crearUsuarioSchema, idParamSchema } from './usuarios.schemas.js';
import * as usuariosService from './usuarios.service.js';

export async function listarController(_req: Request, res: Response) {
  const usuarios = await usuariosService.listar();
  res.json(usuarios);
}

export async function obtenerController(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const usuario = await usuariosService.obtener(id);
  res.json(usuario);
}

export async function crearController(req: Request, res: Response) {
  const datos = crearUsuarioSchema.parse(req.body);
  const usuario = await usuariosService.crear(datos);
  res.status(201).json(usuario);
}

export async function bloquearController(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const usuario = await usuariosService.bloquear(id);
  res.json(usuario);
}

export async function desbloquearController(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const usuario = await usuariosService.desbloquear(id);
  res.json(usuario);
}
