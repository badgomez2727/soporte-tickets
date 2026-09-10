import type { Request, Response } from 'express';
import { HttpError } from '../../shared/http-error.js';
import * as ticketsService from './tickets.service.js';
import {
  actualizarTicketSchema,
  cambiarEstadoSchema,
  crearComentarioSchema,
  crearTicketSchema,
  idParamSchema,
  listarTicketsQuerySchema,
  reasignarSchema,
} from './tickets.schemas.js';

function requerirUsuario(req: Request) {
  if (!req.usuario) {
    throw HttpError.unauthorized();
  }
  return req.usuario;
}

export async function listarController(req: Request, res: Response) {
  const filtros = listarTicketsQuerySchema.parse(req.query);
  const resultado = await ticketsService.listar(filtros);
  res.json(resultado);
}

export async function obtenerController(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const ticket = await ticketsService.obtener(id);
  res.json(ticket);
}

export async function crearController(req: Request, res: Response) {
  const usuario = requerirUsuario(req);
  const datos = crearTicketSchema.parse(req.body);
  const ticket = await ticketsService.crear(datos, usuario.id);
  res.status(201).json(ticket);
}

export async function actualizarController(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const cambios = actualizarTicketSchema.parse(req.body);
  const ticket = await ticketsService.actualizar(id, cambios);
  res.json(ticket);
}

export async function cambiarEstadoController(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { estado } = cambiarEstadoSchema.parse(req.body);
  const ticket = await ticketsService.cambiarEstado(id, estado);
  res.json(ticket);
}

export async function reasignarController(req: Request, res: Response) {
  const usuario = requerirUsuario(req);
  const { id } = idParamSchema.parse(req.params);
  const { agenteId } = reasignarSchema.parse(req.body);
  const ticket = await ticketsService.reasignar(id, agenteId, usuario.id);
  res.json(ticket);
}

export async function agregarComentarioController(req: Request, res: Response) {
  const usuario = requerirUsuario(req);
  const { id } = idParamSchema.parse(req.params);
  const { cuerpo } = crearComentarioSchema.parse(req.body);
  const comentario = await ticketsService.agregarComentario(id, usuario.id, cuerpo);
  res.status(201).json(comentario);
}

export async function eliminarController(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  await ticketsService.eliminar(id);
  res.status(204).send();
}
