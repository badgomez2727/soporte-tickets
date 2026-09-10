import type { EstadoTicket, PrioridadTicket, RolUsuario } from './tipos.js';

// Mismos 7 valores que EstadoTicket en schema.prisma — duplicados acá (ver
// tickets.schemas.ts en el API, mismo criterio) porque el frontend no
// comparte tipos con el backend.
export const ESTADOS: EstadoTicket[] = [
  'nuevo',
  'asignado',
  'en_progreso',
  'en_espera_cliente',
  'resuelto',
  'cerrado',
  'reabierto',
];

export const PRIORIDADES: PrioridadTicket[] = ['baja', 'media', 'alta', 'critica'];

export const ETIQUETAS_ESTADO: Record<EstadoTicket, string> = {
  nuevo: 'Nuevo',
  asignado: 'Asignado',
  en_progreso: 'En progreso',
  en_espera_cliente: 'En espera del cliente',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
  reabierto: 'Reabierto',
};

export const ETIQUETAS_PRIORIDAD: Record<PrioridadTicket, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

export const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  administrador: 'Administrador',
  agente: 'Agente',
  supervisor: 'Supervisor',
};

// Estados que cuentan como "abierto" — mismo criterio que el backend usó
// para el índice y las consultas de queries.sql (ver README de la API).
export const ESTADOS_ABIERTOS: EstadoTicket[] = [
  'nuevo',
  'asignado',
  'en_progreso',
  'en_espera_cliente',
  'reabierto',
];
