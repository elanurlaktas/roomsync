import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

const validUser = { email: 'test.user@roomsync.dev', password: 'password123' };

describe('POST /auth/register', () => {
  it('yeni kullanıcıyı member rolüyle oluşturur (201)', async () => {
    const res = await request(app).post('/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: validUser.email, role: 'member' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('geçersiz e-posta/şifre için 400 döner', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('aynı e-posta ile ikinci kayıtta 409 döner', async () => {
    await request(app).post('/auth/register').send(validUser);
    const res = await request(app).post('/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(validUser);
  });

  it('doğru bilgilerle giriş yapar ve access token + refresh cookie döner (200)', async () => {
    const res = await request(app).post('/auth/login').send(validUser);

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe(validUser.email);
    const cookies = res.headers['set-cookie'];
    expect(cookies?.some((c: string) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('yanlış şifrede 401 döner', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: validUser.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('var olmayan kullanıcıda 401 döner', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'yok@roomsync.dev', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(validUser);
  });

  it('geçerli refresh cookie ile yeni access token üretir ve rotasyonlar (200)', async () => {
    const loginRes = await request(app).post('/auth/login').send(validUser);
    const refreshCookie = loginRes.headers['set-cookie'][0];

    const refreshRes = await request(app).post('/auth/refresh').set('Cookie', refreshCookie);

    expect(refreshRes.status).toBe(200);
    const decoded = jwt.verify(refreshRes.body.accessToken, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    expect(decoded).toMatchObject({ role: 'member' });
    const newRefreshCookie = refreshRes.headers['set-cookie'][0];
    expect(newRefreshCookie).not.toBe(refreshCookie);
  });

  it('rotasyonlanmış (eski) refresh token tekrar kullanılırsa 401 döner', async () => {
    const loginRes = await request(app).post('/auth/login').send(validUser);
    const oldCookie = loginRes.headers['set-cookie'][0];

    await request(app).post('/auth/refresh').set('Cookie', oldCookie);
    const reuseRes = await request(app).post('/auth/refresh').set('Cookie', oldCookie);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('refresh cookie olmadan 401 döner', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('geçersiz (JWT olmayan) refresh cookie ile 401 döner', async () => {
    const res = await request(app).post('/auth/refresh').set('Cookie', 'refreshToken=not-a-real-jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('sub claim\'i olmayan (ama doğru secret ile imzalanmış) refresh token ile 401 döner', async () => {
    const tokenWithoutSub = jwt.sign({}, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${tokenWithoutSub}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /auth/logout', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(validUser);
  });

  it('geçerli access token ile çıkış yapar (204) ve refresh token geçersizleşir', async () => {
    const loginRes = await request(app).post('/auth/login').send(validUser);
    const refreshCookie = loginRes.headers['set-cookie'][0];

    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post('/auth/refresh').set('Cookie', refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it('access token olmadan 401 döner', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});
