import { Router } from 'express';
import { asyncHandler } from '../../shared/async-handler.js';
import { autenticar } from '../../shared/middleware/autenticar.js';
import { autorizarRol } from '../../shared/middleware/autorizar-rol.js';
import { autorizarPropiedadTicket } from './autorizar-propiedad-ticket.js';
import {
  actualizarController,
  agregarComentarioController,
  cambiarEstadoController,
  crearController,
  eliminarController,
  listarController,
  obtenerController,
  reasignarController,
} from './tickets.controller.js';

export const ticketsRoutes = Router();

ticketsRoutes.use(autenticar);

ticketsRoutes.get('/', asyncHandler(listarController));
ticketsRoutes.get('/:id', asyncHandler(obtenerController));
ticketsRoutes.post('/', asyncHandler(crearController));

// Autorización por propiedad: Administrador/Supervisor sobre cualquier
// ticket, Agente solo sobre los que tiene asignados.
ticketsRoutes.patch('/:id', asyncHandler(autorizarPropiedadTicket), asyncHandler(actualizarController));
ticketsRoutes.patch('/:id/estado', asyncHandler(autorizarPropiedadTicket), asyncHandler(cambiarEstadoController));

// Reasignar es una acción de gestión (decidir A QUIÉN pertenece el
// ticket), no "actualizar lo propio": la autorización acá es por rol, no
// por propiedad — un agente no reasigna, ni siquiera sus propios tickets.
ticketsRoutes.patch(
  '/:id/reasignar',
  autorizarRol('administrador', 'supervisor'),
  asyncHandler(reasignarController),
);

// Comentar no está sujeto a la restricción de propiedad: es colaboración
// entre el personal sobre un caso, no una modificación del ticket en sí
// (ver README > Supuestos).
ticketsRoutes.post('/:id/comentarios', asyncHandler(agregarComentarioController));

// Eliminar es destructivo y no depende de a quién está asignado el ticket.
ticketsRoutes.delete('/:id', autorizarRol('administrador'), asyncHandler(eliminarController));
