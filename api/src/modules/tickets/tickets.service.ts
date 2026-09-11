import { Prisma, type RolUsuario, type Ticket } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../shared/prisma.js';
import { HttpError } from '../../shared/http-error.js';
import type {
  actualizarTicketSchema,
  crearTicketSchema,
  listarTicketsQuerySchema,
} from './tickets.schemas.js';

// Campos seguros de un Usuario embebido en la respuesta de un ticket (autor
// de comentario, agente asignado). Mismo principio que aUsuarioPublico en
// el módulo de auth — passwordHash nunca sale, acá aplicado a relaciones
// embebidas en vez de a un Usuario completo.
const SELECT_USUARIO_SEGURO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  fechaCreacion: true,
} satisfies Prisma.UsuarioSelect;

async function requerirTicket(id: string): Promise<Ticket> {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw HttpError.notFound('Ticket no encontrado');
  }
  return ticket;
}

type Filtros = z.infer<typeof listarTicketsQuerySchema>;

export async function listar(filtros: Filtros) {
  const { pagina, porPagina, ...where } = filtros;

  const [datos, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy: { fechaCreacion: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    datos,
    meta: { total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) },
  };
}

export async function obtener(id: string, rolSolicitante: RolUsuario) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      cliente: true,
      agente: { select: SELECT_USUARIO_SEGURO },
      comentarios: {
        // Filtrado en la consulta, no en el frontend: un Agente nunca
        // recibe los comentarios internos en el JSON, no es que la
        // interfaz los oculte después de traerlos.
        where: rolSolicitante === 'agente' ? { esInterno: false } : undefined,
        orderBy: { fechaCreacion: 'asc' },
        include: { usuario: { select: SELECT_USUARIO_SEGURO } },
      },
    },
  });

  if (!ticket) {
    throw HttpError.notFound('Ticket no encontrado');
  }

  return ticket;
}

type DatosCrear = z.infer<typeof crearTicketSchema>;

export async function crear(datos: DatosCrear, creadoPorId: string): Promise<Ticket> {
  // Igual patrón que la reasignación: si se crea con agente ya asignado, el
  // ticket y su primera fila de historial se escriben juntos.
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({
      data: {
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        prioridad: datos.prioridad,
        clienteId: datos.clienteId,
        agenteId: datos.agenteId,
        estado: datos.agenteId ? 'asignado' : 'nuevo',
      },
    });

    if (datos.agenteId) {
      await tx.historialAsignacion.create({
        data: { ticketId: ticket.id, agenteId: datos.agenteId, asignadoPorId: creadoPorId },
      });
    }

    return ticket;
  });
}

type DatosActualizar = z.infer<typeof actualizarTicketSchema>;

export async function actualizar(id: string, cambios: DatosActualizar): Promise<Ticket> {
  await requerirTicket(id);
  return prisma.ticket.update({ where: { id }, data: cambios });
}

export async function cambiarEstado(id: string, nuevoEstado: Ticket['estado']): Promise<Ticket> {
  const ticket = await requerirTicket(id);

  const data: Prisma.TicketUpdateInput = { estado: nuevoEstado };

  if (nuevoEstado === 'reabierto') {
    // Pedido explícito: si no se limpiara, las consultas 5 y 8 de
    // queries.sql seguirían contando el ticket como resuelto por tener
    // fecha_resolucion no nula, aunque su estado ya no lo sea.
    data.fechaResolucion = null;
  } else if ((nuevoEstado === 'resuelto' || nuevoEstado === 'cerrado') && ticket.fechaResolucion === null) {
    // Fijación al resolver. También cubre el caso de cerrar directo sin
    // pasar por "resuelto" antes; si ya estaba fijada, no se pisa (para no
    // perder la fecha real de resolución si después solo se cierra).
    data.fechaResolucion = new Date();
  }

  return prisma.ticket.update({ where: { id }, data });
}

export async function reasignar(id: string, nuevoAgenteId: string, asignadoPorId: string): Promise<Ticket> {
  await requerirTicket(id);

  // Transacción: si una de las dos escrituras falla, la otra no debe
  // quedar aplicada — es la razón de ser de este endpoint (ver README).
  const [ticket] = await prisma.$transaction([
    prisma.ticket.update({ where: { id }, data: { agenteId: nuevoAgenteId } }),
    prisma.historialAsignacion.create({
      data: { ticketId: id, agenteId: nuevoAgenteId, asignadoPorId },
    }),
  ]);

  return ticket;
}

export async function agregarComentario(
  ticketId: string,
  usuarioId: string,
  rolSolicitante: RolUsuario,
  cuerpo: string,
  esInterno: boolean,
) {
  // Solo Administrador/Supervisor pueden marcar un comentario como interno.
  // Es una regla de autorización (quién puede hacer qué), no de forma —
  // por eso vive acá y no en el schema de Zod (que solo valida el tipo).
  if (esInterno && rolSolicitante === 'agente') {
    throw HttpError.forbidden('Un Agente no puede crear comentarios internos');
  }

  await requerirTicket(ticketId);
  return prisma.comentario.create({
    data: { ticketId, usuarioId, cuerpo, esInterno },
    include: { usuario: { select: SELECT_USUARIO_SEGURO } },
  });
}

export async function eliminar(id: string): Promise<void> {
  await requerirTicket(id);

  try {
    await prisma.ticket.delete({ where: { id } });
  } catch (error) {
    // Los FK de historial_asignaciones/comentarios hacia tickets son
    // ON DELETE RESTRICT (ver migración): un ticket con historial o
    // comentarios no se puede borrar. Se traduce a un 409 claro en vez de
    // dejar pasar el error crudo de Postgres como un 500 genérico.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw HttpError.conflict('No se puede eliminar un ticket con historial de asignaciones o comentarios');
    }
    throw error;
  }
}
