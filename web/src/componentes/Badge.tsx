import { ETIQUETAS_ESTADO, ETIQUETAS_PRIORIDAD } from '../constantes.js';
import type { EstadoTicket, PrioridadTicket } from '../tipos.js';

export function BadgeEstado({ estado }: { estado: EstadoTicket }) {
  return <span className={`badge badge-estado-${estado}`}>{ETIQUETAS_ESTADO[estado]}</span>;
}

export function BadgePrioridad({ prioridad }: { prioridad: PrioridadTicket }) {
  return <span className={`badge badge-prioridad-${prioridad}`}>{ETIQUETAS_PRIORIDAD[prioridad]}</span>;
}
