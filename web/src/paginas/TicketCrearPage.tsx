import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../api-client.js';
import { ETIQUETAS_PRIORIDAD, PRIORIDADES } from '../constantes.js';
import type { Agente, Cliente, PrioridadTicket, Ticket } from '../tipos.js';

export function TicketCrearPage() {
  const navegar = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<PrioridadTicket>('media');
  const [clienteId, setClienteId] = useState('');
  const [agenteId, setAgenteId] = useState('');

  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiGet<Cliente[]>('/clientes').then(setClientes).catch(() => undefined);
    apiGet<Agente[]>('/usuarios/agentes').then(setAgentes).catch(() => undefined);
  }, []);

  const agentesActivos = agentes.filter((a) => a.activo);

  function validar(): boolean {
    const errores: Record<string, string> = {};
    if (!titulo.trim()) errores.titulo = 'El título es obligatorio';
    if (!descripcion.trim()) errores.descripcion = 'La descripción es obligatoria';
    if (!clienteId) errores.clienteId = 'Seleccione un cliente';
    setErroresCampos(errores);
    return Object.keys(errores).length === 0;
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setErrorServidor(null);

    if (!validar()) return;

    setEnviando(true);
    try {
      const ticket = await apiPost<Ticket>('/tickets', {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        prioridad,
        clienteId,
        agenteId: agenteId || undefined,
      });
      navegar(`/tickets/${ticket.id}`, { replace: true });
    } catch (error) {
      setErrorServidor(error instanceof Error ? error.message : 'No se pudo crear el ticket');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1>Nuevo ticket</h1>

      <div className="tarjeta">
        <form className="formulario" onSubmit={manejarEnvio} noValidate>
          <div className="campo">
            <label htmlFor="titulo">Título</label>
            <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={enviando} />
            {erroresCampos.titulo && <span className="error-texto">{erroresCampos.titulo}</span>}
          </div>

          <div className="campo">
            <label htmlFor="descripcion">Descripción</label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              disabled={enviando}
            />
            {erroresCampos.descripcion && <span className="error-texto">{erroresCampos.descripcion}</span>}
          </div>

          <div className="campo">
            <label htmlFor="prioridad">Prioridad</label>
            <select
              id="prioridad"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as PrioridadTicket)}
              disabled={enviando}
            >
              {PRIORIDADES.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_PRIORIDAD[valor]}
                </option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="cliente">Cliente</label>
            <select id="cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} disabled={enviando}>
              <option value="">Seleccione un cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {erroresCampos.clienteId && <span className="error-texto">{erroresCampos.clienteId}</span>}
          </div>

          <div className="campo">
            <label htmlFor="agente">Agente (opcional)</label>
            <select id="agente" value={agenteId} onChange={(e) => setAgenteId(e.target.value)} disabled={enviando}>
              <option value="">Sin asignar</option>
              {agentesActivos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {errorServidor && (
            <p className="aviso-error" role="alert">
              {errorServidor}
            </p>
          )}

          <button type="submit" className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}
