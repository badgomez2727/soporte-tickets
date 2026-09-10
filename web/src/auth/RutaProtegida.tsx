import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.js';
import type { RolUsuario } from '../tipos.js';

type Props = {
  children: ReactNode;
  // Si se omite, cualquier rol autenticado puede entrar.
  rolesPermitidos?: RolUsuario[];
};

/**
 * Puerta de navegación: redirige a /login si no hay sesión, o a /tickets si
 * el rol no alcanza para esta ruta. Esto es usabilidad, no seguridad — la
 * autorización real (por rol y por propiedad del recurso) ya se verifica
 * en el servidor en cada petición; esta ruta protegida solo evita mostrar
 * una pantalla que de todas formas va a fallar contra el API.
 */
export function RutaProtegida({ children, rolesPermitidos }: Props) {
  const { estadoAuth } = useAuth();
  const ubicacion = useLocation();

  if (estadoAuth.estado !== 'autenticado') {
    return <Navigate to="/login" state={{ desde: ubicacion }} replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(estadoAuth.usuario.rol)) {
    return <Navigate to="/tickets" replace />;
  }

  return children;
}
