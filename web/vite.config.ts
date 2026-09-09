import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El front llama a /api y Vite lo reenvia al backend:
    // asi no hay CORS en desarrollo ni URLs absolutas en el codigo.
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
