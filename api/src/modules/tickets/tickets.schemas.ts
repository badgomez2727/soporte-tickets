import { z } from 'zod';

// Mismos valores que EstadoTicket/PrioridadTicket en schema.prisma. Se
// duplican como literales acá (igual que ya se hizo en auth.schemas.ts y
// jwt.ts) en vez de derivarlos dinámicamente del cliente de Prisma — mantiene
// Zod desacoplado de Prisma, a costa de tener que actualizar dos lugares si
// el enunciado agrega un estado nuevo (ver README > "Qué pasa con millones
// de registros", ya se aceptó ese mismo costo para queries.sql).
const ESTADOS = [
  'nuevo',
  'asignado',
  'en_progreso',
  'en_espera_cliente',
  'resuelto',
  'cerrado',
  'reabierto',
] as const;

const PRIORIDADES = ['baja', 'media', 'alta', 'critica'] as const;

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const crearTicketSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().min(1),
  prioridad: z.enum(PRIORIDADES),
  clienteId: z.string().uuid(),
  // Opcional: un ticket se puede crear sin agente asignado (estado "nuevo").
  agenteId: z.string().uuid().optional(),
});

export const actualizarTicketSchema = z
  .object({
    titulo: z.string().min(1).optional(),
    descripcion: z.string().min(1).optional(),
    prioridad: z.enum(PRIORIDADES).optional(),
    clienteId: z.string().uuid().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe incluir al menos un campo para actualizar',
  });

export const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS),
});

export const reasignarSchema = z.object({
  agenteId: z.string().uuid(),
});

export const crearComentarioSchema = z.object({
  cuerpo: z.string().min(1),
});

export const listarTicketsQuerySchema = z.object({
  estado: z.enum(ESTADOS).optional(),
  prioridad: z.enum(PRIORIDADES).optional(),
  clienteId: z.string().uuid().optional(),
  agenteId: z.string().uuid().optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().positive().max(100).default(20),
});
