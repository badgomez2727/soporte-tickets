type ApiError = { error: { message: string; details?: unknown } };

/**
 * Cliente unico del API. Centralizar el fetch evita repetir manejo de errores
 * y deja un solo lugar donde agregar auth o reintentos despues.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error.message ?? `Error ${res.status}`);
  }

  return (await res.json()) as T;
}
