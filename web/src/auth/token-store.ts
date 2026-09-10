// Guarda los tokens EN MEMORIA (una variable de módulo), nunca en
// localStorage/sessionStorage. localStorage es legible por cualquier script
// que corra en la página — si hubiera una vulnerabilidad XSS, un token ahí
// queda expuesto y sigue siendo válido hasta que expire. En memoria, el
// token solo vive mientras la pestaña está abierta y desaparece al
// recargar la página (ver README > Autenticación en el frontend — la
// alternativa robusta de verdad es una cookie httpOnly, no implementada
// acá, ver "Qué falta").
//
// Vive fuera de React (no es un useState) a propósito: api-client.ts
// necesita leer y escribir el token fuera de cualquier componente, para
// poder agregar el header de autorización y refrescar automáticamente sin
// tener que pasar el token a mano por cada función que hace fetch.

export type Tokens = { accessToken: string; refreshToken: string };

let tokensActuales: Tokens | null = null;
let alExpirarSesion: (() => void) | null = null;

export function establecerTokens(tokens: Tokens | null): void {
  tokensActuales = tokens;
}

export function obtenerTokens(): Tokens | null {
  return tokensActuales;
}

/** Lo registra AuthContext al montar: qué hacer cuando el refresh falla. */
export function alExpirarLaSesion(callback: () => void): void {
  alExpirarSesion = callback;
}

/** Llamado por api-client.ts cuando ni el access token ni el refresh sirven. */
export function notificarSesionExpirada(): void {
  tokensActuales = null;
  alExpirarSesion?.();
}
