import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('responde 200 con estado ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('rutas desconocidas', () => {
  it('responde 404 con el formato de error del API', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBeTypeOf('string');
  });
});
