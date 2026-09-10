import * as argon2 from 'argon2';

// argon2id es la recomendación actual de OWASP para hash de contraseñas
// (resiste mejor ataques con GPU/ASIC que bcrypt). Se pasa explícito en vez
// de confiar en el default de la librería, para que quede claro en el
// código qué algoritmo se está usando sin tener que ir a leer la doc.
const OPCIONES = { type: argon2.argon2id } as const;

export function hashearPassword(passwordPlano: string): Promise<string> {
  return argon2.hash(passwordPlano, OPCIONES);
}

// argon2.verify no necesita que le pasen las opciones de nuevo: el hash
// guardado ya lleva codificado el algoritmo y los parámetros con los que se
// generó (igual que bcrypt), así que no hay riesgo de comparar con los
// parámetros equivocados si en el futuro cambia OPCIONES.
export function verificarPassword(hash: string, passwordPlano: string): Promise<boolean> {
  return argon2.verify(hash, passwordPlano);
}
