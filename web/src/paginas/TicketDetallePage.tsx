import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet, apiPatch, apiPost } from '../api-client.js';
import { useAuth } from '../auth/AuthContext.js';
import { BadgeEstado, BadgePrioridad } from '../componentes/Badge.js';
import { ESTADOS, ETIQUETAS_ESTADO } from '../constantes.js';
import type { Agente, EstadoTicket, TicketDetalle } from '../tipos.js';

function formatearFecha(fechaIso: string | null): string {
  if (!fechaIso) return '—';
  return new Date(fechaIso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

export function TicketDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { estadoAuth } = useAuth();
  const usuario = estadoAuth.estado === 'autenticado' ? estadoAuth.usuario : null;

  const [ticket, setTicket] = useState<TicketDetalle | null>(null);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevoComentario, setNuevoComentario] = useState('');
  const [comentarioInterno, setComentarioInterno] = useState(false);
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  const [nuevoEstado, setNuevoEstado] = useState<EstadoTicket | ''>('');
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  const [agenteReasignar, setAgenteReasignar] = useState('');
  const [reasignando, setReasignando] = useState(false);

  const cargarTicket = useCallback(() => {
    if (!id) return;
    setCargando(true);
    setError(null);
    apiGet<TicketDetalle>(`/tickets/${id}`)
      .then((datos) => {
        setTicket(datos);
        setNuevoEstado(datos.estado);
      })
      .catch((error: Error) => setError(error.message))
      .finally(() => setCargando(false));
  }, [id]);

  useEffect(() => {
    cargarTicket();
  }, [cargarTicket]);

  useEffect(() => {
    if (usuario && (usuario.rol === 'administrador' || usuario.rol === 'supervisor')) {
      apiGet<Agente[]>('/usuarios/agentes').then(setAgentes).catch(() => undefined);
    }
  }, [usuario]);

  if (!id) return null;
  if (cargando) return <p className="estado-carga">Cargando…</p>;
  if (error) return <p className="aviso-error">{error}</p>;
  if (!ticket || !usuario) return null;

  // Mismo criterio de autorización por propiedad que el servidor: un
  // Agente solo actúa sobre lo suyo. Esto es solo para no mostrar
  // controles que el servidor de todas formas rechazaría (ver
  // RutaProtegida.tsx) — la autorización real está en el API.
  const puedeGestionar =
    usuario.rol === 'administrador' || usuario.rol === 'supervisor' || ticket.agenteId === usuario.id;
  const puedeReasignar = usuario.rol === 'administrador' || usuario.rol === 'supervisor';
  // Mismo criterio que el servidor (tickets.service.ts > agregarComentario):
  // solo Administrador/Supervisor pueden marcar un comentario como interno.
  const puedeComentarInterno = usuario.rol === 'administrador' || usuario.rol === 'supervisor';

  async function manejarCambiarEstado(evento: FormEvent) {
    evento.preventDefault();
    if (!nuevoEstado) return;
    setGuardandoEstado(true);
    setError(null);
    try {
      await apiPatch(`/tickets/${id}/estado`, { estado: nuevoEstado });
      cargarTicket();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo cambiar el estado');
    } finally {
      setGuardandoEstado(false);
    }
  }

  async function manejarReasignar(evento: FormEvent) {
    evento.preventDefault();
    if (!agenteReasignar) return;
    setReasignando(true);
    setError(null);
    try {
      await apiPatch(`/tickets/${id}/reasignar`, { agenteId: agenteReasignar });
      setAgenteReasignar('');
      cargarTicket();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo reasignar el ticket');
    } finally {
      setReasignando(false);
    }
  }

  async function manejarComentario(evento: FormEvent) {
    evento.preventDefault();
    if (!nuevoComentario.trim()) return;
    setEnviandoComentario(true);
    setError(null);
    try {
      await apiPost(`/tickets/${id}/comentarios`, {
        cuerpo: nuevoComentario.trim(),
        esInterno: comentarioInterno,
      });
      setNuevoComentario('');
      setComentarioInterno(false);
      cargarTicket();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo agregar el comentario');
    } finally {
      setEnviandoComentario(false);
    }
  }

  return (
    <div>
      <p>
        <Link to="/tickets">← Volver al listado</Link>
      </p>

      <div className="tarjeta">
        <div className="encabezado-pagina">
          <h1>{ticket.titulo}</h1>
          <div className="fila-badges">
            <BadgeEstado estado={ticket.estado} />
            <BadgePrioridad prioridad={ticket.prioridad} />
          </div>
        </div>

        <p>{ticket.descripcion}</p>

        <dl className="detalle-meta">
          <div>
            <dt>Cliente</dt>
            <dd>{ticket.cliente.nombre}</dd>
          </div>
          <div>
            <dt>Agente asignado</dt>
            <dd>
              {ticket.agente ? ticket.agente.nombre : 'Sin asignar'}
              {ticket.agente && !ticket.agente.activo ? ' (inactivo)' : ''}
            </dd>
          </div>
          <div>
            <dt>Creado</dt>
            <dd>{formatearFecha(ticket.fechaCreacion)}</dd>
          </div>
          <div>
            <dt>Última actualización</dt>
            <dd>{formatearFecha(ticket.fechaActualizacion)}</dd>
          </div>
          <div>
            <dt>Fecha de resolución</dt>
            <dd>{formatearFecha(ticket.fechaResolucion)}</dd>
          </div>
        </dl>

        {error && <p className="aviso-error">{error}</p>}

        {/* Los controles que el rol no permite no se muestran, pero eso es
            solo usabilidad: la autorización real ya está en el servidor
            (autorizar-propiedad-ticket.ts / autorizarRol). */}
        <div className="acciones">
          {puedeGestionar && (
            <form className="accion" onSubmit={manejarCambiarEstado}>
              <div className="campo">
                <label htmlFor="nuevo-estado">Cambiar estado</label>
                <select
                  id="nuevo-estado"
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value as EstadoTicket)}
                  disabled={guardandoEstado}
                >
                  {ESTADOS.map((valor) => (
                    <option key={valor} value={valor}>
                      {ETIQUETAS_ESTADO[valor]}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn" disabled={guardandoEstado || nuevoEstado === ticket.estado}>
                {guardandoEstado ? 'Guardando…' : 'Guardar estado'}
              </button>
            </form>
          )}

          {puedeReasignar && (
            <form className="accion" onSubmit={manejarReasignar}>
              <div className="campo">
                <label htmlFor="reasignar">Reasignar a</label>
                <select
                  id="reasignar"
                  value={agenteReasignar}
                  onChange={(e) => setAgenteReasignar(e.target.value)}
                  disabled={reasignando}
                >
                  <option value="">Seleccione un agente</option>
                  {agentes
                    .filter((a) => a.activo)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <button type="submit" className="btn" disabled={reasignando || !agenteReasignar}>
                {reasignando ? 'Reasignando…' : 'Reasignar'}
              </button>
            </form>
          )}
        </div>
      </div>

      <h2 className="seccion-comentarios">Comentarios</h2>

      <div className="lista-comentarios">
        {ticket.comentarios.length === 0 && <p className="texto-tenue">Todavía no hay comentarios.</p>}
        {ticket.comentarios.map((comentario) => (
          <div
            key={comentario.id}
            className={comentario.esInterno ? 'comentario comentario-interno' : 'comentario'}
          >
            <p className="comentario-meta">
              {comentario.usuario.nombre} · {formatearFecha(comentario.fechaCreacion)}
              {comentario.esInterno && <span className="badge badge-interno">Interno</span>}
            </p>
            <p>{comentario.cuerpo}</p>
          </div>
        ))}
      </div>

      <form className="formulario" onSubmit={manejarComentario}>
        <div className="campo">
          <label htmlFor="comentario">Agregar comentario</label>
          <textarea
            id="comentario"
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
            disabled={enviandoComentario}
          />
        </div>
        {puedeComentarInterno && (
          <label className="campo-checkbox">
            <input
              type="checkbox"
              checked={comentarioInterno}
              onChange={(e) => setComentarioInterno(e.target.checked)}
              disabled={enviandoComentario}
            />
            Comentario interno (no visible para el agente asignado)
          </label>
        )}
        <button type="submit" className="btn btn-primario" disabled={enviandoComentario || !nuevoComentario.trim()}>
          {enviandoComentario ? 'Enviando…' : 'Comentar'}
        </button>
      </form>
    </div>
  );
}
