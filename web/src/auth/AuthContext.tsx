import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiPost } from '../api-client.js';
import type { SesionIniciada, Usuario } from '../tipos.js';
import { alExpirarLaSesion, establecerTokens, obtenerTokens } from './token-store.js';

type EstadoAuth = { estado: 'no-autenticado' } | { estado: 'autenticado'; usuario: Usuario };

type ContextoAuth = {
  estadoAuth: EstadoAuth;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const ContextoAuthReact = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Sin sesión persistida (a propósito: los tokens viven en memoria, no en
  // localStorage — ver token-store.ts), así que siempre se arranca acá.
  // Un recargue de página cierra la sesión; no hace falta un estado de
  // "cargando" inicial para restaurarla.
  const [estadoAuth, setEstadoAuth] = useState<EstadoAuth>({ estado: 'no-autenticado' });

  useEffect(() => {
    alExpirarLaSesion(() => setEstadoAuth({ estado: 'no-autenticado' }));
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const sesion = await apiPost<SesionIniciada>('/auth/login', { email, password });
    establecerTokens({ accessToken: sesion.accessToken, refreshToken: sesion.refreshToken });
    setEstadoAuth({ estado: 'autenticado', usuario: sesion.usuario });
  }, []);

  const cerrarSesion = useCallback(async () => {
    const tokens = obtenerTokens();
    establecerTokens(null);
    setEstadoAuth({ estado: 'no-autenticado' });

    if (tokens) {
      // Best-effort: si falla (ej. ya no hay red), la sesión local ya se
      // cerró igual — no tiene sentido bloquear el logout por esto.
      await apiPost('/auth/logout', { refreshToken: tokens.refreshToken }).catch(() => undefined);
    }
  }, []);

  const valor = useMemo(() => ({ estadoAuth, iniciarSesion, cerrarSesion }), [estadoAuth, iniciarSesion, cerrarSesion]);

  return <ContextoAuthReact.Provider value={valor}>{children}</ContextoAuthReact.Provider>;
}

export function useAuth(): ContextoAuth {
  const contexto = useContext(ContextoAuthReact);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return contexto;
}
