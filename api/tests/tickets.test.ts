// Pruebas de integración del módulo de tickets — solo lo esencial pedido:
// autorización por propiedad, reasignación con su historial, y transición
// de estados. El resto del módulo (CRUD general, listado/filtros,
// dashboard) se ejerce a mano contra la app real, no con más pruebas acá
// (alcance cerrado, ver docs/uso-ia.md).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/prisma.js';
import { hashearPassword } from '../src/shared/auth/password.js';

const app = createApp();

const PASSWORD = 'clave-de-prueba-tickets-123';

let clienteId: string;
let adminId: string;
let agenteAId: string;
let agenteBId: string;
let tokenAdmin: string;
let tokenAgenteA: string;
let tokenAgenteB: string;

beforeAll(async () => {
  const cliente = await prisma.cliente.create({ data: { nombre: 'Cliente de Prueba (tickets.test.ts)' } });
  clienteId = cliente.id;

  const [admin, agenteA, agenteB] = await Promise.all([
    prisma.usuario.create({
      data: {
        nombre: 'Admin Tickets',
        email: 'admin.tickets.pruebas@infinivirt.test',
        passwordHash: await hashearPassword(PASSWORD),
        rol: 'administrador',
      },
    }),
    prisma.usuario.create({
      data: {
        nombre: 'Agente A Tickets',
        email: 'agentea.tickets.pruebas@infinivirt.test',
        passwordHash: await hashearPassword(PASSWORD),
        rol: 'agente',
      },
    }),
    prisma.usuario.create({
      data: {
        nombre: 'Agente B Tickets',
        email: 'agenteb.tickets.pruebas@infinivirt.test',
        passwordHash: await hashearPassword(PASSWORD),
        rol: 'agente',
      },
    }),
  ]);
  adminId = admin.id;
  agenteAId = agenteA.id;
  agenteBId = agenteB.id;

  const [loginAdmin, loginA, loginB] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: admin.email, password: PASSWORD }),
    request(app).post('/api/auth/login').send({ email: agenteA.email, password: PASSWORD }),
    request(app).post('/api/auth/login').send({ email: agenteB.email, password: PASSWORD }),
  ]);
  tokenAdmin = loginAdmin.body.accessToken;
  tokenAgenteA = loginA.body.accessToken;
  tokenAgenteB = loginB.body.accessToken;
});

afterAll(async () => {
  await prisma.comentario.deleteMany({ where: { ticket: { clienteId } } });
  await prisma.historialAsignacion.deleteMany({ where: { ticket: { clienteId } } });
  await prisma.ticket.deleteMany({ where: { clienteId } });
  await prisma.tokenRefresco.deleteMany({ where: { usuarioId: { in: [adminId, agenteAId, agenteBId] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [adminId, agenteAId, agenteBId] } } });
  await prisma.cliente.delete({ where: { id: clienteId } });
  await prisma.$disconnect();
});

async function crearTicketDePrueba(titulo: string, agenteId: string) {
  return prisma.ticket.create({
    data: { titulo, descripcion: 'Descripción de prueba', prioridad: 'media', clienteId, agenteId, estado: 'asignado' },
  });
}

describe('Autorización por propiedad (PATCH /api/tickets/:id)', () => {
  it('un agente NO puede actualizar un ticket asignado a otro agente', async () => {
    const ticket = await crearTicketDePrueba('Ticket de A (ajeno para B)', agenteAId);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${tokenAgenteB}`)
      .send({ titulo: 'Intento de B' });

    expect(res.status).toBe(403);
  });

  it('un agente SÍ puede actualizar un ticket asignado a él', async () => {
    const ticket = await crearTicketDePrueba('Ticket de A (propio)', agenteAId);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${tokenAgenteA}`)
      .send({ titulo: 'Actualizado por A' });

    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe('Actualizado por A');
  });

  it('un administrador puede actualizar cualquier ticket, sin importar a quién esté asignado', async () => {
    const ticket = await crearTicketDePrueba('Ticket de A (admin actualiza)', agenteAId);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ titulo: 'Actualizado por admin' });

    expect(res.status).toBe(200);
  });
});

describe('Reasignación en transacción (PATCH /api/tickets/:id/reasignar)', () => {
  it('actualiza ticket.agenteId y crea la fila de historial correspondiente, juntos', async () => {
    const ticket = await crearTicketDePrueba('Ticket a reasignar', agenteAId);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}/reasignar`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ agenteId: agenteBId });

    expect(res.status).toBe(200);
    expect(res.body.agenteId).toBe(agenteBId);

    const historial = await prisma.historialAsignacion.findMany({ where: { ticketId: ticket.id } });
    expect(historial).toHaveLength(1);
    expect(historial[0]?.agenteId).toBe(agenteBId);
    expect(historial[0]?.asignadoPorId).toBe(adminId);
  });

  it('un agente no puede reasignar (es una acción de administrador/supervisor, no de propiedad)', async () => {
    const ticket = await crearTicketDePrueba('Ticket a reasignar (bloqueado)', agenteAId);

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}/reasignar`)
      .set('Authorization', `Bearer ${tokenAgenteA}`)
      .send({ agenteId: agenteBId });

    expect(res.status).toBe(403);
  });
});

type ComentarioRespuesta = { cuerpo: string; esInterno: boolean };

describe('Comentarios internos (POST /api/tickets/:id/comentarios)', () => {
  it('un agente no recibe comentarios internos en el detalle del ticket', async () => {
    const ticket = await crearTicketDePrueba('Ticket con comentario interno', agenteAId);

    const externo = await request(app)
      .post(`/api/tickets/${ticket.id}/comentarios`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ cuerpo: 'Comentario visible para todos' });
    expect(externo.status).toBe(201);

    const interno = await request(app)
      .post(`/api/tickets/${ticket.id}/comentarios`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ cuerpo: 'Nota interna solo para gestión', esInterno: true });
    expect(interno.status).toBe(201);

    // El dueño del ticket (agenteA) no debe recibir el interno en el JSON.
    const comoAgente = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${tokenAgenteA}`);

    expect(comoAgente.status).toBe(200);
    const cuerposAgente = (comoAgente.body.comentarios as ComentarioRespuesta[]).map((c) => c.cuerpo);
    expect(cuerposAgente).toContain('Comentario visible para todos');
    expect(cuerposAgente).not.toContain('Nota interna solo para gestión');

    // Confirma que es un filtro por rol, no que el comentario nunca se
    // guardó: un Administrador sí lo recibe.
    const comoAdmin = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const cuerposAdmin = (comoAdmin.body.comentarios as ComentarioRespuesta[]).map((c) => c.cuerpo);
    expect(cuerposAdmin).toContain('Nota interna solo para gestión');
  });

  it('un agente que intenta crear un comentario interno recibe 403', async () => {
    const ticket = await crearTicketDePrueba('Ticket comentario interno bloqueado', agenteAId);

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comentarios`)
      .set('Authorization', `Bearer ${tokenAgenteA}`)
      .send({ cuerpo: 'Intento de nota interna', esInterno: true });

    expect(res.status).toBe(403);

    // Efecto real: no se creó ningún comentario, no es solo el código de estado.
    const comentarios = await prisma.comentario.findMany({ where: { ticketId: ticket.id } });
    expect(comentarios).toHaveLength(0);
  });
});

describe('Transición de estados (PATCH /api/tickets/:id/estado)', () => {
  it('fija fecha_resolucion al resolver, y la limpia al reabrir', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        titulo: 'Ticket a resolver',
        descripcion: 'Descripción de prueba',
        prioridad: 'baja',
        clienteId,
        agenteId: agenteAId,
        estado: 'en_progreso',
      },
    });

    const resuelto = await request(app)
      .patch(`/api/tickets/${ticket.id}/estado`)
      .set('Authorization', `Bearer ${tokenAgenteA}`)
      .send({ estado: 'resuelto' });

    expect(resuelto.status).toBe(200);
    expect(resuelto.body.fechaResolucion).not.toBeNull();

    const reabierto = await request(app)
      .patch(`/api/tickets/${ticket.id}/estado`)
      .set('Authorization', `Bearer ${tokenAgenteA}`)
      .send({ estado: 'reabierto' });

    expect(reabierto.status).toBe(200);
    expect(reabierto.body.fechaResolucion).toBeNull();
  });
});
