// Cada función corre, literal, la consulta correspondiente de queries.sql
// (mismo número en el comentario) vía $queryRaw — no se reescriben como
// query builder de Prisma. Así el endpoint es demostrablemente la misma
// consulta que ya se verificó a mano contra el seed (ver README), no una
// reinterpretación que podría divergir en sutilezas (ver el propio ajuste
// de NOT IN -> IN documentado en README > "Qué pasa con millones de
// registros" — estas consultas ya vienen con esa lección aplicada).
//
// COUNT(...) en Postgres devuelve bigint, que Prisma trae como BigInt de
// JS — no serializable directo a JSON. Se convierte a number en cada
// función antes de devolver (ningún conteo de este dominio se acerca a un
// volumen donde eso pierda precisión).
import { prisma } from '../../shared/prisma.js';

type FilaTicketsPorClienteEstado = {
  cliente_id: string;
  cliente_nombre: string;
  estado: string;
  cantidad_tickets: bigint;
};

// Consulta 1.
export async function ticketsPorClienteYEstado() {
  const filas = await prisma.$queryRaw<FilaTicketsPorClienteEstado[]>`
    SELECT c.id AS cliente_id, c.nombre AS cliente_nombre, t.estado, COUNT(t.id) AS cantidad_tickets
    FROM clientes c
    JOIN tickets t ON c.id = t.cliente_id
    GROUP BY c.id, c.nombre, t.estado
    ORDER BY c.nombre, t.estado
  `;
  return filas.map((f) => ({ ...f, cantidad_tickets: Number(f.cantidad_tickets) }));
}

type FilaTopClientes = {
  cliente_id: string;
  cliente_nombre: string;
  total_tickets_altos_criticos: bigint;
};

// Consulta 2.
export async function topClientesPrioridadAlta() {
  const filas = await prisma.$queryRaw<FilaTopClientes[]>`
    SELECT c.id AS cliente_id, c.nombre AS cliente_nombre, COUNT(t.id) AS total_tickets_altos_criticos
    FROM clientes c
    JOIN tickets t ON c.id = t.cliente_id
    WHERE t.prioridad IN ('alta', 'critica')
    GROUP BY c.id, c.nombre
    ORDER BY total_tickets_altos_criticos DESC
    LIMIT 5
  `;
  return filas.map((f) => ({ ...f, total_tickets_altos_criticos: Number(f.total_tickets_altos_criticos) }));
}

type FilaTicketSinActualizar = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  fecha_actualizacion: Date;
  agente_asignado: string | null;
};

// Consulta 3. Apoyada en el índice tickets(estado, fecha_actualizacion) —
// por eso IN de estados abiertos y no NOT IN (ver README).
export async function ticketsSinActualizar() {
  return prisma.$queryRaw<FilaTicketSinActualizar[]>`
    SELECT t.id, t.titulo, t.estado, t.prioridad, t.fecha_actualizacion, u.nombre AS agente_asignado
    FROM tickets t
    LEFT JOIN usuarios u ON t.agente_id = u.id
    WHERE t.estado IN ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'reabierto')
      AND t.fecha_actualizacion < NOW() - INTERVAL '48 hours'
  `;
}

type FilaAgenteMasResuelve = {
  usuario_id: string;
  usuario_nombre: string;
  tickets_resueltos: bigint;
};

// Consulta 4.
export async function agenteMasResuelveMes() {
  const filas = await prisma.$queryRaw<FilaAgenteMasResuelve[]>`
    SELECT u.id AS usuario_id, u.nombre AS usuario_nombre, COUNT(t.id) AS tickets_resueltos
    FROM usuarios u
    JOIN tickets t ON u.id = t.agente_id
    WHERE t.estado IN ('resuelto', 'cerrado')
      AND t.fecha_resolucion >= NOW() - INTERVAL '1 month'
    GROUP BY u.id, u.nombre
    ORDER BY tickets_resueltos DESC
    LIMIT 1
  `;
  const fila = filas[0];
  return fila ? { ...fila, tickets_resueltos: Number(fila.tickets_resueltos) } : null;
}

type FilaTiempoPromedio = {
  prioridad: string;
  promedio_horas_resolucion: number;
};

// Consulta 5.
export async function tiempoPromedioResolucion() {
  const filas = await prisma.$queryRaw<FilaTiempoPromedio[]>`
    SELECT prioridad, AVG(EXTRACT(EPOCH FROM (fecha_resolucion - fecha_creacion)) / 3600) AS promedio_horas_resolucion
    FROM tickets
    WHERE estado IN ('resuelto', 'cerrado')
      AND fecha_resolucion IS NOT NULL
    GROUP BY prioridad
  `;
  return filas.map((f) => ({ ...f, promedio_horas_resolucion: Number(f.promedio_horas_resolucion) }));
}

type FilaTicketsAbiertosPorAgente = {
  agente_id: string;
  agente_nombre: string;
  tickets_abiertos: bigint;
};

// Consulta 6.
export async function ticketsAbiertosPorAgente() {
  const filas = await prisma.$queryRaw<FilaTicketsAbiertosPorAgente[]>`
    SELECT u.id AS agente_id, u.nombre AS agente_nombre, COUNT(t.id) AS tickets_abiertos
    FROM usuarios u
    JOIN tickets t ON u.id = t.agente_id
    WHERE t.estado IN ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'reabierto')
    GROUP BY u.id, u.nombre
    ORDER BY tickets_abiertos DESC
  `;
  return filas.map((f) => ({ ...f, tickets_abiertos: Number(f.tickets_abiertos) }));
}

type FilaReasignados = {
  id: string;
  titulo: string;
  total_reasignaciones: bigint;
};

// Consulta 7.
export async function ticketsReasignadosFrecuentes() {
  const filas = await prisma.$queryRaw<FilaReasignados[]>`
    SELECT t.id, t.titulo, COUNT(h.id) - 1 AS total_reasignaciones
    FROM tickets t
    JOIN historial_asignaciones h ON t.id = h.ticket_id
    GROUP BY t.id, t.titulo
    HAVING COUNT(h.id) - 1 > 2
  `;
  return filas.map((f) => ({ ...f, total_reasignaciones: Number(f.total_reasignaciones) }));
}

// Consulta 8.
export async function porcentajeCerrados30Dias() {
  const [fila] = await prisma.$queryRaw<{ porcentaje_cerrados: number }[]>`
    SELECT COALESCE(
        COUNT(CASE WHEN estado = 'cerrado' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0),
        0
    ) AS porcentaje_cerrados
    FROM tickets
    WHERE fecha_creacion >= NOW() - INTERVAL '30 days'
  `;
  return { porcentajeCerrados: Number(fila?.porcentaje_cerrados ?? 0) };
}

// Consulta 9.
export async function totalAbiertos() {
  const [fila] = await prisma.$queryRaw<{ total_abiertos: bigint }[]>`
    SELECT COUNT(*) AS total_abiertos
    FROM tickets
    WHERE estado IN ('nuevo', 'asignado', 'en_progreso', 'en_espera_cliente', 'reabierto')
  `;
  return { totalAbiertos: Number(fila?.total_abiertos ?? 0) };
}

type FilaTicketAgenteInactivo = {
  id: string;
  titulo: string;
  estado: string;
  prioridad: string;
  agente_id: string;
  agente_nombre: string;
};

// No es una de las 8 consultas de queries.sql — se agregó para el
// frontend, que pide explícitamente esta vista para Supervisor y
// Administrador (ver README). Mismo criterio que las demás: SQL directo,
// sin filtros ni parámetros externos.
export async function ticketsAgentesInactivos() {
  return prisma.$queryRaw<FilaTicketAgenteInactivo[]>`
    SELECT t.id, t.titulo, t.estado, t.prioridad, u.id AS agente_id, u.nombre AS agente_nombre
    FROM tickets t
    JOIN usuarios u ON t.agente_id = u.id
    WHERE u.activo = false
    ORDER BY u.nombre, t.titulo
  `;
}
