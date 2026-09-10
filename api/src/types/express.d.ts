import type { RolUsuario } from '@prisma/client';

// Extiende Request para que el resto del código no tenga que castear
// `req.usuario` a mano en cada controlador. Lo llena el middleware
// `autenticar` (shared/middleware/autenticar.ts).
declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: string;
        rol: RolUsuario;
      };
    }
  }
}

export {};
