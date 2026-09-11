import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';

export function LoginPage() {
  const { estadoAuth, iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Ya autenticado y visitando /login (ej. volvió atrás): redirección según
  // estado de autenticación, no se muestra el formulario de nuevo.
  if (estadoAuth.estado === 'autenticado') {
    return <Navigate to="/tickets" replace />;
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Ingrese email y contraseña');
      return;
    }

    setEnviando(true);
    try {
      await iniciarSesion(email, password);
      // Si venía de una ruta protegida, vuelve ahí; si no, al listado.
      const destino =
        (ubicacion.state as { desde?: { pathname: string } } | null)?.desde?.pathname ?? '/tickets';
      navegar(destino, { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-envoltorio">
      <div className="marca-login" aria-hidden="true">
        <span className="nav-marca-icono"></span>
        Soporte Tickets
      </div>
      <div className="tarjeta login-tarjeta">
        <h1>Iniciar sesión</h1>
        <form className="formulario" onSubmit={manejarEnvio} noValidate>
          <div className="campo">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(evento) => setEmail(evento.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              disabled={enviando}
            />
          </div>

          {error && (
            <p className="aviso-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
