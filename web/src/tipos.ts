// Tipos que reflejan las formas de respuesta del API. Se mantienen a mano
// (no generados desde Prisma): el frontend es un paquete npm aparte, sin
// acceso al cliente de Prisma del backend, y duplicar estas formas es
// simple de mantener sincronizado a este tamaño de proyecto.

export type RolUsuario = 'administrador' | 'agente' | 'supervisor';

export type EstadoTicket =
  | 'nuevo'
  | 'asignado'
  | 'en_progreso'
  | 'en_espera_cliente'
  | 'resuelto'
  | 'cerrado'
  | 'reabierto';

export type PrioridadTicket = 'baja' | 'media' | 'alta' | 'critica';

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  fechaCreacion: string;
};

export type Cliente = {
  id: string;
  nombre: string;
};

export type Agente = {
  id: string;
  nombre: string;
  activo: boolean;
};

export type Ticket = {
  id: string;
  titulo: string;
  descripcion: string;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  clienteId: string;
  agenteId: string | null;
  fechaCreacion: string;
  fechaActualizacion: string;
  fechaResolucion: string | null;
};

export type Comentario = {
  id: string;
  ticketId: string;
  usuarioId: string;
  cuerpo: string;
  esInterno: boolean;
  fechaCreacion: string;
  usuario: Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol' | 'activo' | 'fechaCreacion'>;
};

export type TicketDetalle = Ticket & {
  cliente: Cliente;
  agente: Pick<Usuario, 'id' | 'nombre' | 'email' | 'rol' | 'activo' | 'fechaCreacion'> | null;
  comentarios: Comentario[];
};

export type ListadoTickets = {
  datos: Ticket[];
  meta: { total: number; pagina: number; porPagina: number; totalPaginas: number };
};

export type SesionIniciada = {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
};

// Formas de respuesta de /api/dashboard/* — un tipo por endpoint, mismo
// nombre de campos que devuelve cada consulta de queries.sql (snake_case:
// son resultados de SQL crudo, no pasan por el mapeo camelCase de Prisma).
export type FilaTicketsPorClienteEstado = {
  cliente_id: string;
  cliente_nombre: string;
  estado: EstadoTicket;
  cantidad_tickets: number;
};

export type FilaTopCliente = {
  cliente_id: string;
  cliente_nombre: string;
  total_tickets_altos_criticos: number;
};

export type FilaTicketSinActualizar = {
  id: string;
  titulo: string;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  fecha_actualizacion: string;
  agente_asignado: string | null;
};

export type AgenteMasResuelveMes = { usuario_id: string; usuario_nombre: string; tickets_resueltos: number } | null;

export type FilaTiempoPromedio = { prioridad: PrioridadTicket; promedio_horas_resolucion: number };

export type FilaTicketsAbiertosPorAgente = { agente_id: string; agente_nombre: string; tickets_abiertos: number };

export type FilaReasignados = { id: string; titulo: string; total_reasignaciones: number };

export type FilaTicketAgenteInactivo = {
  id: string;
  titulo: string;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  agente_id: string;
  agente_nombre: string;
};
