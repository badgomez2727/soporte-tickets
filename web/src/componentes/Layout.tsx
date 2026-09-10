import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { ETIQUETAS_ROL } from '../constantes.js';

function claseEnlace({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-enlace activo' : 'nav-enlace';
}

export function Layout({ children }: { children: ReactNode }) {
  const { estadoAuth, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  async function manejarCerrarSesion() {
    await cerrarSesion();
    navegar('/login', { replace: true });
  }

  const usuario = estadoAuth.estado === 'autenticado' ? estadoAuth.usuario : null;

  return (
    <div className="layout">
      <header className="nav">
        <NavLink to="/tickets" className="nav-marca">
          Soporte Tickets
        </NavLink>

        {usuario && (
          <nav className="nav-enlaces">
            <NavLink to="/tickets" className={claseEnlace} end>
              Tickets
            </NavLink>
            <NavLink to="/tickets/nuevo" className={claseEnlace}>
              Nuevo ticket
            </NavLink>
            {/* Oculto para Agente: el backend restringe /api/dashboard a
                Administrador/Supervisor — mostrar el enlace solo llevaría a
                una pantalla que va a fallar contra el API. Es usabilidad,
                no la autorización real. */}
            {(usuario.rol === 'administrador' || usuario.rol === 'supervisor') && (
              <NavLink to="/dashboard" className={claseEnlace}>
                Dashboard
              </NavLink>
            )}
            {usuario.rol === 'administrador' && (
              <NavLink to="/usuarios" className={claseEnlace}>
                Usuarios
              </NavLink>
            )}
          </nav>
        )}

        {usuario && (
          <div className="nav-enlaces">
            <span className="nav-usuario">
              {usuario.nombre} · {ETIQUETAS_ROL[usuario.rol]}
            </span>
            <button type="button" className="btn" onClick={manejarCerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <main className="contenedor">{children}</main>
    </div>
  );
}
