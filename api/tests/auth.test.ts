// Pruebas de integración del módulo de autenticación y autorización.
// A diferencia de health.test.ts, estas SÍ requieren Postgres real (no hay
// forma honesta de probar "el middleware consulta la base en cada
// petición" con un mock de esa misma base). Necesita DATABASE_URL apuntando
// a una base con las migraciones aplicadas — en CI, un servicio de Postgres
// dedicado (ver .github/workflows/ci.yml); en local, la de docker-compose.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { hashearPassword } from '../src/shared/auth/password.js';

const app = createApp();

const PASSWORD_AGENTE = 'clave-agente-de-prueba-123';
const PASSWORD_ADMIN = 'clave-admin-de-prueba-123';
const EMAIL_AGENTE = 'agente.pruebas.auth@infinivirt.test';
const EMAIL_ADMIN = 'admin.pruebas.auth@infinivirt.test';

let agenteId: string;
let adminId: string;

beforeAll(async () => {
  const [agente, admin] = await Promise.all([
    prisma.usuario.create({
      data: {
        nombre: 'Agente de Prueba',
        email: EMAIL_AGENTE,
        passwordHash: await hashearPassword(PASSWORD_AGENTE),
        rol: 'agente',
      },
    }),
    prisma.usuario.create({
      data: {
        nombre: 'Admin de Prueba',
        email: EMAIL_ADMIN,
        passwordHash: await hashearPassword(PASSWORD_ADMIN),
        rol: 'administrador',
      },
    }),
  ]);
  agenteId = agente.id;
  adminId = admin.id;
});

afterAll(async () => {
  await prisma.tokenRefresco.deleteMany({ where: { usuarioId: { in: [agenteId, adminId] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [agenteId, adminId] } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('inicia sesión con credenciales correctas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL_AGENTE, password: PASSWORD_AGENTE });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
    expect(res.body.usuario.email).toBe(EMAIL_AGENTE);
    // El passwordHash nunca debe salir en una respuesta del API.
    expect(res.body.usuario.passwordHash).toBeUndefined();
  });

  it('rechaza contraseña incorrecta y email inexistente con el MISMO mensaje', async () => {
    const passwordIncorrecta = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL_AGENTE, password: 'password-equivocada' });

    const emailInexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-existe-en-el-sistema@infinivirt.test', password: 'cualquiera' });

    expect(passwordIncorrecta.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    // La prueba real de que no se puede enumerar usuarios: el mensaje es
    // idéntico sin importar cuál de los dos casos ocurrió.
    expect(passwordIncorrecta.body.error.message).toBe(emailInexistente.body.error.message);
  });
});

describe('Acceso a rutas protegidas', () => {
  it('rechaza la petición si no viene ningún token', async () => {
    const res = await request(app).get('/api/auth/perfil');
    expect(res.status).toBe(401);
  });

  it('rechaza la petición si el token no es válido', async () => {
    const res = await request(app).get('/api/auth/perfil').set('Authorization', 'Bearer token-que-no-existe');
    expect(res.status).toBe(401);
  });

  it('rechaza por rol insuficiente (agente contra un endpoint solo-Administrador)', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL_AGENTE, password: PASSWORD_AGENTE });

    const res = await request(app)
      .get('/api/usuarios')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Refresh token: rotación y detección de reuso', () => {
  it('rota el token en cada refresh y rechaza reusar uno ya rotado', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL_ADMIN, password: PASSWORD_ADMIN });
    const refreshOriginal = login.body.refreshToken as string;

    const primeraRenovacion = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshOriginal });

    expect(primeraRenovacion.status).toBe(200);
    expect(primeraRenovacion.body.refreshToken).not.toBe(refreshOriginal);

    // Reusar el token ya rotado es exactamente la señal de robo que debe
    // disparar el rechazo (y, en el servicio, la revocación de todas las
    // sesiones del usuario — ver refresh-token.ts).
    const reuso = await request(app).post('/api/auth/refresh').send({ refreshToken: refreshOriginal });
    expect(reuso.status).toBe(401);
  });
});

// Esta es la prueba más importante del módulo: bloquear a un usuario debe
// surtir efecto antes de que su access token expire por sí solo (hasta 15
// minutos). Va al final del archivo porque deja al agente bloqueado — las
// pruebas anteriores necesitan que todavía pueda iniciar sesión.
describe('Bloquear un usuario invalida sus sesiones de inmediato', () => {
  it('un usuario bloqueado con un access token todavía vigente ya no puede acceder', async () => {
    const loginAgente = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL_AGENTE, password: PASSWORD_AGENTE });
    const tokenAgente = loginAgente.body.accessToken as string;

    // Confirmación de que el token sirve antes del bloqueo (control del experimento).
    const antesDeBloquear = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${tokenAgente}`);
    expect(antesDeBloquear.status).toBe(200);

    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL_ADMIN, password: PASSWORD_ADMIN });
    const tokenAdmin = loginAdmin.body.accessToken as string;

    const bloqueo = await request(app)
      .patch(`/api/usuarios/${agenteId}/bloquear`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(bloqueo.status).toBe(200);
    expect(bloqueo.body.activo).toBe(false);

    // Mismo access token de antes, sin haber expirado — la firma sigue
    // siendo válida. Debe rechazarse igual, porque `autenticar` consulta
    // usuarios.activo en cada petición, no solo la firma del JWT.
    const despuesDeBloquear = await request(app)
      .get('/api/auth/perfil')
      .set('Authorization', `Bearer ${tokenAgente}`);
    expect(despuesDeBloquear.status).toBe(401);
  });
});
