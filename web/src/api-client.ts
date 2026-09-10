import { establecerTokens, notificarSesionExpirada, obtenerTokens } from './auth/token-store.js';

type ApiError = { error: { message: string; details?: unknown } };

// Varias peticiones pueden expirar al mismo tiempo (el dashboard, por
// ejemplo, dispara varias de una vez): sin esto, cada una intentaría su
// propio refresh en paralelo. El backend rota el refresh token en cada uso
// y detecta reuso — dos refrescos concurrentes con el mismo token harían
// que el segundo pareciera un robo y el backend cerraría TODAS las
// sesiones. Se comparte una sola promesa de refresh entre todas las
// peticiones que la disparan al mismo tiempo.
let refrescoEnCurso: Promise<boolean> | null = null;

async function refrescarToken(): Promise<boolean> {
  if (refrescoEnCurso) return refrescoEnCurso;

  refrescoEnCurso = (async () => {
    const tokens = obtenerTokens();
    if (!tokens) return false;

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!res.ok) return false;

      const nuevos = (await res.json()) as { accessToken: string; refreshToken: string };
      establecerTokens(nuevos);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refrescoEnCurso;
  } finally {
    refrescoEnCurso = null;
  }
}

async function peticion<T>(path: string, opciones: RequestInit = {}, reintentando = false): Promise<T> {
  const tokens = obtenerTokens();
  const headers = new Headers(opciones.headers);
  headers.set('Accept', 'application/json');
  if (opciones.body) headers.set('Content-Type', 'application/json');
  if (tokens) headers.set('Authorization', `Bearer ${tokens.accessToken}`);

  const res = await fetch(`/api${path}`, { ...opciones, headers });

  if (res.status === 401 && tokens && !reintentando) {
    const renovado = await refrescarToken();
    if (renovado) {
      return peticion<T>(path, opciones, true);
    }
    notificarSesionExpirada();
    throw new Error('La sesión expiró, inicie sesión de nuevo');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error.message ?? `Error ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return peticion<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, cuerpo?: unknown): Promise<T> {
  return peticion<T>(path, { method: 'POST', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
}

export function apiPatch<T>(path: string, cuerpo?: unknown): Promise<T> {
  return peticion<T>(path, { method: 'PATCH', body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return peticion<T>(path, { method: 'DELETE' });
}
