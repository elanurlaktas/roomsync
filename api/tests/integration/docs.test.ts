import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('GET /api-docs.json', () => {
  it('geçerli bir OpenAPI 3.0 dokümanı döner', async () => {
    const res = await request(app).get('/api-docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info).toMatchObject({ title: 'RoomSync API' });
  });

  it("Bölüm 7'deki tüm endpoint'leri içerir", async () => {
    const res = await request(app).get('/api-docs.json');

    const paths = Object.keys(res.body.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/health',
        '/auth/register',
        '/auth/login',
        '/auth/refresh',
        '/auth/logout',
        '/rooms',
        '/rooms/{id}',
        '/rooms/{id}/availability',
        '/bookings',
        '/bookings/{id}',
        '/bookings/{id}/cancel',
      ]),
    );
  });

  it('rate limit dışındadır (health gibi)', async () => {
    const results = await Promise.all(
      Array.from({ length: 101 }, () => request(app).get('/api-docs.json')),
    );

    expect(results.every((res) => res.status === 200)).toBe(true);
  });
});

describe('GET /api-docs', () => {
  it('Swagger UI HTML sayfasını döner', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });
});
