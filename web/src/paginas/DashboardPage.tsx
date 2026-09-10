import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api-client.js';
import { useAuth } from '../auth/AuthContext.js';
import { BadgeEstado, BadgePrioridad } from '../componentes/Badge.js';
import { ESTADOS_ABIERTOS, ETIQUETAS_PRIORIDAD } from '../constantes.js';
import type {
  AgenteMasResuelveMes,
  FilaReasignados,
  FilaTicketAgenteInactivo,
  FilaTicketSinActualizar,
  FilaTicketsAbiertosPorAgente,
  FilaTicketsPorClienteEstado,
  FilaTiempoPromedio,
  FilaTopCliente,
  ListadoTickets,
  Ticket,
} from '../tipos.js';

const VEINTICUATRO_HORAS = 24 * 60 * 60 * 1000;
const CUARENTAIOCHO_HORAS = 2 * VEINTICUATRO_HORAS;

function formatearFecha(fechaIso: string): string {
  return new Date(fechaIso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export function DashboardPage() {
  const { estadoAuth } = useAuth();
  if (estadoAuth.estado !== 'autenticado') return null;

  return estadoAuth.usuario.rol === 'agente' ? (
    <DashboardAgente agenteId={estadoAuth.usuario.id} />
  ) : (
    <DashboardGestion />
  );
}

// El agente NO tiene acceso a /api/dashboard/* (ver README > backend, es
// solo Administrador/Supervisor). Su vista se arma con el mismo endpoint
// de listado que ya usa cualquier rol (GET /api/tickets?agenteId=...),
// calculando "vencido" (>48h sin actualizar) en el navegador — no hace
// falta un endpoint nuevo para esto.
function DashboardAgente({ agenteId }: { agenteId: string }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ListadoTickets>(`/tickets?agenteId=${agenteId}&porPagina=100`)
      .then((listado) => setTickets(listado.datos))
      .catch((error: Error) => setError(error.message));
  }, [agenteId]);

  if (error) return <p className="aviso-error">{error}</p>;
  if (!tickets) return <p className="estado-carga">Cargando…</p>;

  const abiertos = tickets.filter((t) => ESTADOS_ABIERTOS.includes(t.estado));
  const ahora = Date.now();
  const vencidos = abiertos.filter((t) => ahora - new Date(t.fechaActualizacion).getTime() > CUARENTAIOCHO_HORAS);

  return (
    <div>
      <h1>Mi dashboard</h1>

      <div className="grid-dashboard">
        <div className="tarjeta">
          <p className="metrica-etiqueta">Mi carga (tickets abiertos)</p>
          <p className="metrica-numero">{abiertos.length}</p>
        </div>
        <div className="tarjeta">
          <p className="metrica-etiqueta">Vencidos (más de 48h sin actualizar)</p>
          <p className="metrica-numero">{vencidos.length}</p>
        </div>
      </div>

      <h2>Mis tickets vencidos</h2>
      <table className="tabla">
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Prioridad</th>
            <th>Última actualización</th>
          </tr>
        </thead>
        <tbody>
          {vencidos.length === 0 && (
            <tr>
              <td colSpan={4} className="texto-tenue">
                No tiene tickets vencidos.
              </td>
            </tr>
          )}
          {vencidos.map((t) => (
            <tr key={t.id}>
              <td>
                <Link to={`/tickets/${t.id}`}>{t.titulo}</Link>
              </td>
              <td>
                <BadgeEstado estado={t.estado} />
              </td>
              <td>
                <BadgePrioridad prioridad={t.prioridad} />
              </td>
              <td>{formatearFecha(t.fechaActualizacion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type DatosGestion = {
  totalAbiertos: { totalAbiertos: number };
  porcentajeCerrados: { porcentajeCerrados: number };
  agenteMasResuelve: AgenteMasResuelveMes;
  porClienteEstado: FilaTicketsPorClienteEstado[];
  topClientes: FilaTopCliente[];
  sinActualizar: FilaTicketSinActualizar[];
  tiempoPromedio: FilaTiempoPromedio[];
  abiertosPorAgente: FilaTicketsAbiertosPorAgente[];
  reasignados: FilaReasignados[];
  agentesInactivos: FilaTicketAgenteInactivo[];
};

// Administrador y Supervisor: la operación completa, apoyada en los 9
// endpoints (uno por consulta de queries.sql) + el de tickets de agentes
// inactivos, agregado para esta vista (ver README).
function DashboardGestion() {
  const [datos, setDatos] = useState<DatosGestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<{ totalAbiertos: number }>('/dashboard/total-abiertos'),
      apiGet<{ porcentajeCerrados: number }>('/dashboard/porcentaje-cerrados-30-dias'),
      apiGet<AgenteMasResuelveMes>('/dashboard/agente-mas-resuelve-mes'),
      apiGet<FilaTicketsPorClienteEstado[]>('/dashboard/tickets-por-cliente-y-estado'),
      apiGet<FilaTopCliente[]>('/dashboard/top-clientes-prioridad-alta'),
      apiGet<FilaTicketSinActualizar[]>('/dashboard/tickets-sin-actualizar'),
      apiGet<FilaTiempoPromedio[]>('/dashboard/tiempo-promedio-resolucion'),
      apiGet<FilaTicketsAbiertosPorAgente[]>('/dashboard/tickets-abiertos-por-agente'),
      apiGet<FilaReasignados[]>('/dashboard/tickets-reasignados-frecuentes'),
      apiGet<FilaTicketAgenteInactivo[]>('/dashboard/tickets-agentes-inactivos'),
    ])
      .then(
        ([
          totalAbiertos,
          porcentajeCerrados,
          agenteMasResuelve,
          porClienteEstado,
          topClientes,
          sinActualizar,
          tiempoPromedio,
          abiertosPorAgente,
          reasignados,
          agentesInactivos,
        ]) =>
          setDatos({
            totalAbiertos,
            porcentajeCerrados,
            agenteMasResuelve,
            porClienteEstado,
            topClientes,
            sinActualizar,
            tiempoPromedio,
            abiertosPorAgente,
            reasignados,
            agentesInactivos,
          }),
      )
      .catch((error: Error) => setError(error.message));
  }, []);

  if (error) return <p className="aviso-error">{error}</p>;
  if (!datos) return <p className="estado-carga">Cargando…</p>;

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="grid-dashboard">
        <div className="tarjeta">
          <p className="metrica-etiqueta">Tickets abiertos</p>
          <p className="metrica-numero">{datos.totalAbiertos.totalAbiertos}</p>
        </div>
        <div className="tarjeta">
          <p className="metrica-etiqueta">% cerrados en los últimos 30 días</p>
          <p className="metrica-numero">{datos.porcentajeCerrados.porcentajeCerrados.toFixed(1)}%</p>
        </div>
        <div className="tarjeta">
          <p className="metrica-etiqueta">Agente que más resolvió (último mes)</p>
          <p className="metrica-numero">
            {datos.agenteMasResuelve ? datos.agenteMasResuelve.tickets_resueltos : '—'}
          </p>
          {datos.agenteMasResuelve && <p className="texto-tenue">{datos.agenteMasResuelve.usuario_nombre}</p>}
        </div>
      </div>

      <div className="seccion-dashboard">
        <h2>Tickets sin actualizar hace más de 48h</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Título</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Agente</th>
              <th>Última actualización</th>
            </tr>
          </thead>
          <tbody>
            {datos.sinActualizar.length === 0 && (
              <tr>
                <td colSpan={5} className="texto-tenue">
                  No hay tickets estancados.
                </td>
              </tr>
            )}
            {datos.sinActualizar.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tickets/${t.id}`}>{t.titulo}</Link>
                </td>
                <td>
                  <BadgeEstado estado={t.estado} />
                </td>
                <td>
                  <BadgePrioridad prioridad={t.prioridad} />
                </td>
                <td>{t.agente_asignado ?? 'Sin asignar'}</td>
                <td>{formatearFecha(t.fecha_actualizacion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="seccion-dashboard">
        <h2>Tickets asignados a agentes inactivos</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Título</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th>Agente (bloqueado)</th>
            </tr>
          </thead>
          <tbody>
            {datos.agentesInactivos.length === 0 && (
              <tr>
                <td colSpan={4} className="texto-tenue">
                  No hay tickets en esta situación.
                </td>
              </tr>
            )}
            {datos.agentesInactivos.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/tickets/${t.id}`}>{t.titulo}</Link>
                </td>
                <td>
                  <BadgeEstado estado={t.estado} />
                </td>
                <td>
                  <BadgePrioridad prioridad={t.prioridad} />
                </td>
                <td>{t.agente_nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="seccion-dashboard">
        <h2>Tickets abiertos por agente</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Agente</th>
              <th>Tickets abiertos</th>
            </tr>
          </thead>
          <tbody>
            {datos.abiertosPorAgente.map((f) => (
              <tr key={f.agente_id}>
                <td>{f.agente_nombre}</td>
                <td>{f.tickets_abiertos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="seccion-dashboard">
        <h2>Top 5 clientes por tickets de prioridad alta/crítica</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tickets alta/crítica</th>
            </tr>
          </thead>
          <tbody>
            {datos.topClientes.map((f) => (
              <tr key={f.cliente_id}>
                <td>{f.cliente_nombre}</td>
                <td>{f.total_tickets_altos_criticos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="seccion-dashboard">
        <h2>Tiempo promedio de resolución por prioridad</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Prioridad</th>
              <th>Horas promedio</th>
            </tr>
          </thead>
          <tbody>
            {datos.tiempoPromedio.map((f) => (
              <tr key={f.prioridad}>
                <td>{ETIQUETAS_PRIORIDAD[f.prioridad]}</td>
                <td>{f.promedio_horas_resolucion.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="seccion-dashboard">
        <h2>Tickets reasignados más de dos veces</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Título</th>
              <th>Reasignaciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.reasignados.length === 0 && (
              <tr>
                <td colSpan={2} className="texto-tenue">
                  No hay tickets con fricción de reasignación.
                </td>
              </tr>
            )}
            {datos.reasignados.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link to={`/tickets/${f.id}`}>{f.titulo}</Link>
                </td>
                <td>{f.total_reasignaciones}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="seccion-dashboard">
        <h2>Tickets por cliente y estado</h2>
        <table className="tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {datos.porClienteEstado.map((f) => (
              <tr key={`${f.cliente_id}-${f.estado}`}>
                <td>{f.cliente_nombre}</td>
                <td>
                  <BadgeEstado estado={f.estado} />
                </td>
                <td>{f.cantidad_tickets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
