import { useEffect, useState } from 'react';
import { apiGet } from './api-client.js';

type Health = { status: string; uptime: number };

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: Health }
  | { kind: 'error'; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    apiGet<Health>('/health')
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', data });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ kind: 'error', message: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Base del proyecto</h1>
      <p>Conexion con el API:</p>

      {state.kind === 'loading' && <p>Consultando...</p>}
      {state.kind === 'error' && <p role="alert">No se pudo conectar: {state.message}</p>}
      {state.kind === 'ready' && (
        <p>
          API respondiendo <strong>{state.data.status}</strong> con {Math.round(state.data.uptime)}s
          en linea.
        </p>
      )}
    </main>
  );
}
