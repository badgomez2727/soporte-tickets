import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet } from '../api-client.js';
import { useAuth } from '../auth/AuthContext.js';
import { BadgeEstado, BadgePrioridad } from '../componentes/Badge.js';
import { ESTADOS, ETIQUETAS_ESTADO, ETIQUETAS_PRIORIDAD, PRIORIDADES } from '../constantes.js';
import type { Agente, Cliente, EstadoTicket, ListadoTickets, PrioridadTicket } from '../tipos.js';

function formatearFecha(fechaIso: string): string {
  return new Date(fechaIso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export function TicketsListaPage() {
  const { estadoAuth } = useAuth();
  const usuario = estadoAuth.estado === 'autenticado' ? estadoAuth.usuario : null;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);

  const [estado, setEstado] = useState<EstadoTicket | ''>('');
  const [prioridad, setPrioridad] = useState<PrioridadTicket | ''>('');
  const [clienteId, setClienteId] = useState('');
  // Preseleccionado con su propio id si es Agente — es un valor por
  // defecto de usabilidad (lo puede quitar, ve el filtro en "Todos" y
  // consulta cualquier ticket igual), no una restricción de acceso. Ver
  // README > Frontend para el razonamiento completo de por qué.
  const [agenteId, setAgenteId] = useState(usuario?.rol === 'agente' ? usuario.id : '');
  const [pagina, setPagina] = useState(1);

  const [listado, setListado] = useState<ListadoTickets | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listas de apoyo para los filtros y para mostrar nombres en la tabla en
  // vez de ids — se cargan una sola vez.
  useEffect(() => {
    apiGet<Cliente[]>('/clientes').then(setClientes).catch(() => undefined);
    apiGet<Agente[]>('/usuarios/agentes').then(setAgentes).catch(() => undefined);
  }, []);

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (estado) parametros.set('estado', estado);
    if (prioridad) parametros.set('prioridad', prioridad);
    if (clienteId) parametros.set('clienteId', clienteId);
    if (agenteId) parametros.set('agenteId', agenteId);
    parametros.set('pagina', String(pagina));

    setCargando(true);
    setError(null);

    apiGet<ListadoTickets>(`/tickets?${parametros.toString()}`)
      .then(setListado)
      .catch((error: Error) => setError(error.message))
      .finally(() => setCargando(false));
  }, [estado, prioridad, clienteId, agenteId, pagina]);

  const nombreCliente = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? '—';
  const nombreAgente = (id: string | null) => (id ? agentes.find((a) => a.id === id)?.nombre ?? '—' : 'Sin asignar');

  function conFiltro<T>(establecer: (valor: T) => void) {
    return (valor: T) => {
      establecer(valor);
      setPagina(1);
    };
  }

  return (
    <div>
      <div className="encabezado-pagina">
        <h1>Tickets</h1>
        <Link to="/tickets/nuevo" className="btn btn-primario">
          Nuevo ticket
        </Link>
      </div>

      <div className="fila-filtros">
        <div className="campo">
          <label htmlFor="filtro-estado">Estado</label>
          <select
            id="filtro-estado"
            value={estado}
            onChange={(e) => conFiltro(setEstado)(e.target.value as EstadoTicket | '')}
          >
            <option value="">Todos</option>
            {ESTADOS.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_ESTADO[valor]}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="filtro-prioridad">Prioridad</label>
          <select
            id="filtro-prioridad"
            value={prioridad}
            onChange={(e) => conFiltro(setPrioridad)(e.target.value as PrioridadTicket | '')}
          >
            <option value="">Todas</option>
            {PRIORIDADES.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_PRIORIDAD[valor]}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="filtro-cliente">Cliente</label>
          <select id="filtro-cliente" value={clienteId} onChange={(e) => conFiltro(setClienteId)(e.target.value)}>
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="filtro-agente">Agente</label>
          <select id="filtro-agente" value={agenteId} onChange={(e) => conFiltro(setAgenteId)(e.target.value)}>
            <option value="">Todos</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
                {!a.activo ? ' (inactivo)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="aviso-error">{error}</p>}
      {cargando && <p className="estado-carga">Cargando…</p>}

      {!cargando && listado && (
        <>
          <table className="tabla">
            <thead>
              <tr>
                <th>Título</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Agente</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {listado.datos.length === 0 && (
                <tr>
                  <td colSpan={6} className="texto-tenue">
                    No hay tickets con estos filtros.
                  </td>
                </tr>
              )}
              {listado.datos.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>{ticket.titulo}</Link>
                  </td>
                  <td>{nombreCliente(ticket.clienteId)}</td>
                  <td>
                    <BadgeEstado estado={ticket.estado} />
                  </td>
                  <td>
                    <BadgePrioridad prioridad={ticket.prioridad} />
                  </td>
                  <td>{nombreAgente(ticket.agenteId)}</td>
                  <td>{formatearFecha(ticket.fechaActualizacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="paginacion">
            <button
              type="button"
              className="btn"
              disabled={listado.meta.pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {listado.meta.pagina} de {Math.max(listado.meta.totalPaginas, 1)} · {listado.meta.total} tickets
            </span>
            <button
              type="button"
              className="btn"
              disabled={listado.meta.pagina >= listado.meta.totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
