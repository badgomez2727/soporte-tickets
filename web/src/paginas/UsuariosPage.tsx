import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiGet, apiPatch, apiPost } from '../api-client.js';
import { ETIQUETAS_ROL } from '../constantes.js';
import type { RolUsuario, Usuario } from '../tipos.js';

const ROLES: RolUsuario[] = ['administrador', 'agente', 'supervisor'];

// Ruta ya protegida por rol en App.tsx (rolesPermitidos={['administrador']}),
// y todos los endpoints que usa esta página exigen Administrador en el
// servidor (usuarios.routes.ts) — ver README > Frontend > Administración de
// usuarios para la verificación completa de que esto es así también sin el
// frontend de por medio.
export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);

  const cargar = useCallback(() => {
    apiGet<Usuario[]>('/usuarios')
      .then(setUsuarios)
      .catch((error: Error) => setError(error.message));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function alternarBloqueo(usuario: Usuario) {
    setAccionEnCurso(usuario.id);
    setError(null);
    try {
      const accion = usuario.activo ? 'bloquear' : 'desbloquear';
      await apiPatch(`/usuarios/${usuario.id}/${accion}`);
      cargar();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo actualizar el usuario');
    } finally {
      setAccionEnCurso(null);
    }
  }

  return (
    <div>
      <h1>Usuarios</h1>

      {error && <p className="aviso-error">{error}</p>}
      {!usuarios && <p className="estado-carga">Cargando…</p>}

      {usuarios && (
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nombre}</td>
                <td>{usuario.email}</td>
                <td>{ETIQUETAS_ROL[usuario.rol]}</td>
                <td>
                  <span className={`badge ${usuario.activo ? 'badge-activo' : 'badge-bloqueado'}`}>
                    {usuario.activo ? 'Activo' : 'Bloqueado'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={usuario.activo ? 'btn btn-peligro' : 'btn'}
                    disabled={accionEnCurso === usuario.id}
                    onClick={() => alternarBloqueo(usuario)}
                  >
                    {accionEnCurso === usuario.id ? 'Guardando…' : usuario.activo ? 'Bloquear' : 'Desbloquear'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="seccion-comentarios">Crear usuario</h2>
      <FormularioCrearUsuario alCrear={cargar} />
    </div>
  );
}

function FormularioCrearUsuario({ alCrear }: { alCrear: () => void }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('agente');

  const [erroresCampos, setErroresCampos] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function validar(): boolean {
    const errores: Record<string, string> = {};
    if (!nombre.trim()) errores.nombre = 'El nombre es obligatorio';
    if (!email.trim()) errores.email = 'El email es obligatorio';
    if (password.length < 8) errores.password = 'La contraseña debe tener al menos 8 caracteres';
    setErroresCampos(errores);
    return Object.keys(errores).length === 0;
  }

  async function manejarEnvio(evento: FormEvent) {
    evento.preventDefault();
    setErrorServidor(null);
    setExito(null);

    if (!validar()) return;

    setEnviando(true);
    try {
      await apiPost('/usuarios', { nombre: nombre.trim(), email: email.trim(), password, rol });
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('agente');
      setExito('Usuario creado.');
      alCrear();
    } catch (error) {
      setErrorServidor(error instanceof Error ? error.message : 'No se pudo crear el usuario');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta">
      <form className="formulario" onSubmit={manejarEnvio} noValidate>
        <div className="campo">
          <label htmlFor="usuario-nombre">Nombre</label>
          <input id="usuario-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={enviando} />
          {erroresCampos.nombre && <span className="error-texto">{erroresCampos.nombre}</span>}
        </div>

        <div className="campo">
          <label htmlFor="usuario-email">Email</label>
          <input
            id="usuario-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
          />
          {erroresCampos.email && <span className="error-texto">{erroresCampos.email}</span>}
        </div>

        <div className="campo">
          <label htmlFor="usuario-password">Contraseña</label>
          <input
            id="usuario-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={enviando}
          />
          {erroresCampos.password && <span className="error-texto">{erroresCampos.password}</span>}
        </div>

        <div className="campo">
          <label htmlFor="usuario-rol">Rol</label>
          <select id="usuario-rol" value={rol} onChange={(e) => setRol(e.target.value as RolUsuario)} disabled={enviando}>
            {ROLES.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_ROL[valor]}
              </option>
            ))}
          </select>
        </div>

        {errorServidor && (
          <p className="aviso-error" role="alert">
            {errorServidor}
          </p>
        )}
        {exito && <p className="ayuda-texto">{exito}</p>}

        <button type="submit" className="btn btn-primario" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>
    </div>
  );
}
