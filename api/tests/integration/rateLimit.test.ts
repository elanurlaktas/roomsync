import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

// Her test beforeEach'te yeni bir createApp() örneği alır, dolayısıyla
// express-rate-limit'in bellek içi sayaçları da her testte sıfırdan başlar
// (bkz. src/middleware/rateLimit.ts).

describe('Login rate limiting (createLoginRateLimiter)', () => {
  it('limit (5/15dk) aşıldığında 429 + RATE_LIMITED döner', async () => {
    const credentials = { email: 'ratelimit@roomsync.dev', password: 'wrong-password' };

    const withinLimit = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post('/auth/login').send(credentials)),
    );
    expect(withinLimit.every((res) => res.status === 401)).toBe(true);

    const blocked = await request(app).post('/auth/login').send(credentials);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('login limiti diğer endpoint\'leri etkilemez', async () => {
    const credentials = { email: 'ratelimit2@roomsync.dev', password: 'wrong-password' };
    await Promise.all(Array.from({ length: 6 }, () => request(app).post('/auth/login').send(credentials)));

    const registerRes = await request(app)
      .post('/auth/register')
      .send({ email: 'other@roomsync.dev', password: 'password123' });
    expect(registerRes.status).toBe(201);
  });
});

describe('Genel rate limiting (createGeneralRateLimiter)', () => {
  it('limit (100/15dk) aşıldığında 429 + RATE_LIMITED döner', async () => {
    const withinLimit = await Promise.all(
      Array.from({ length: 100 }, () => request(app).get('/rooms')),
    );
    expect(withinLimit.every((res) => res.status === 401)).toBe(true);

    const blocked = await request(app).get('/rooms');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('/health genel limitten muaftır', async () => {
    await Promise.all(Array.from({ length: 105 }, () => request(app).get('/health')));

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Merkezi error middleware — malformed JSON', () => {
  it('bozuk JSON gövdesi 400 + VALIDATION_ERROR döner (500 değil)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
