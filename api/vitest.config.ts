import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    // argon2id es deliberadamente costoso en CPU (ver shared/auth/password.ts).
    // El default de Vitest (5s) alcanza sobrado en una máquina sin carga, pero
    // con varios archivos de test hasheando en paralelo bajo contención de CPU
    // se puede superar, dando un timeout que no es un fallo real del código.
    // Verificado en desarrollo local (máquina compartida con otros procesos):
    // corriendo la suite 3 veces seguidas, tests individuales tardaron entre
    // 3s y 5.1s — cerca del límite viejo de 5s, sin superarlo, pero sin
    // margen real. 15s da margen cómodo ahí.
    //
    // En CI (GitHub Actions, runner de 2 vCPU) el mismo cuello de botella
    // aplica igual o peor: es una máquina modesta, y Postgres corre como
    // contenedor compitiendo por esos mismos 2 vCPU durante los tests. No se
    // midió directamente ahí (este proyecto no tiene corridas de CI previas
    // para comparar), así que se asume el escenario más conservador en vez
    // de reusar el mismo margen que ya resultó justo en local: el doble,
    // 30s. Es una espera aceptable incluso para un test que sí está roto de
    // verdad — sigue fallando, solo que lo confirma un poco más tarde.
    testTimeout: process.env.CI ? 30000 : 15000,
  },
});
