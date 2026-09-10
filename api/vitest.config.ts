import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // argon2id es deliberadamente costoso en CPU (ver shared/auth/password.ts).
    // El default de Vitest (5s) alcanza sobrado en una máquina sin carga, pero
    // con varios archivos de test hasheando en paralelo bajo contención de CPU
    // (ej. esta misma máquina corriendo otros contenedores) se puede superar,
    // dando un timeout que no es un fallo real del código. 15s da margen real.
    testTimeout: 15000,
  },
});
