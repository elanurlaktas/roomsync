import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { db } from '../../src/db/index.js';
import { bookings, rooms, users } from '../../src/db/schema.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

async function insertUser(role: 'member' | 'admin' = 'member') {
  const [user] = await db
    .insert(users)
    .values({ email: `${randomUUID()}@roomsync.dev`, passwordHash: 'irrelevant-for-these-tests', role })
    .returning();
  if (!user) throw new Error('test fixture oluşturulamadı');
  return user;
}

function signToken(userId: string, role: 'member' | 'admin'): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

async function insertRoom(overrides: Partial<typeof rooms.$inferInsert> = {}) {
  const [room] = await db
    .insert(rooms)
    .values({ name: 'Toplantı Odası A', capacity: 8, location: '3. Kat', ...overrides })
    .returning();
  if (!room) throw new Error('test fixture oluşturulamadı');
  return room;
}

function isoAt(hoursFromBase: number): string {
  const base = new Date('2026-09-01T09:00:00.000Z');
  return new Date(base.getTime() + hoursFromBase * 60 * 60 * 1000).toISOString();
}

const validPayload = (roomId: string, hourOffset = 0) => ({
  roomId,
  title: 'Sprint Planlama',
  startsAt: isoAt(hourOffset),
  endsAt: isoAt(hourOffset + 1),
});

describe('POST /bookings', () => {
  it('token olmadan 401 döner', async () => {
    const res = await request(app).post('/bookings').send({});
    expect(res.status).toBe(401);
  });

  it('geçersiz input için 400 döner', async () => {
    const member = await insertUser('member');
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`)
      .send({ roomId: 'not-a-uuid', title: '', startsAt: 'invalid', endsAt: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('bitiş, başlangıçtan önceyse 400 döner', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`)
      .send({ roomId: room.id, title: 'Toplantı', startsAt: isoAt(2), endsAt: isoAt(1) });

    expect(res.status).toBe(400);
  });

  it('var olmayan oda için 404 döner', async () => {
    const member = await insertUser('member');
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`)
      .send(validPayload(randomUUID()));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });

  it('pasif oda için 409 döner', async () => {
    const member = await insertUser('member');
    const room = await insertRoom({ isActive: false });
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`)
      .send(validPayload(room.id));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_INACTIVE');
  });

  it('geçerli input ile rezervasyon oluşturur (201)', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`)
      .send(validPayload(room.id));

    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({
      roomId: room.id,
      userId: member.id,
      status: 'confirmed',
      title: 'Sprint Planlama',
      department: null,
    });
  });

  it('department alanıyla rezervasyon oluşturur ve response\'da döner', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`)
      .send({ ...validPayload(room.id), department: 'Mühendislik' });

    expect(res.status).toBe(201);
    expect(res.body.booking.department).toBe('Mühendislik');
  });

  it('boş string department, null olarak kaydedilir', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`)
      .send({ ...validPayload(room.id), department: '   ' });

    expect(res.status).toBe(201);
    expect(res.body.booking.department).toBeNull();
  });

  it('çakışan rezervasyon için 409 döner', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const token = signToken(member.id, 'member');
    await request(app).post('/bookings').set('Authorization', `Bearer ${token}`).send(validPayload(room.id, 0));

    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId: room.id, title: 'Çakışan Toplantı', startsAt: isoAt(0.5), endsAt: isoAt(1.5) });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BOOKING_CONFLICT');
  });

  it('aynı odaya, aynı ana çakışan iki eşzamanlı istekten sadece biri başarılı olur', async () => {
    const memberA = await insertUser('member');
    const memberB = await insertUser('member');
    const room = await insertRoom();
    const tokenA = signToken(memberA.id, 'member');
    const tokenB = signToken(memberB.id, 'member');
    const payload = { roomId: room.id, title: 'Eşzamanlı Rezervasyon', startsAt: isoAt(10), endsAt: isoAt(11) };

    const [resA, resB] = await Promise.all([
      request(app).post('/bookings').set('Authorization', `Bearer ${tokenA}`).send(payload),
      request(app).post('/bookings').set('Authorization', `Bearer ${tokenB}`).send(payload),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const confirmed = await db.query.bookings.findMany({
      where: and(eq(bookings.roomId, room.id), eq(bookings.status, 'confirmed')),
    });
    expect(confirmed).toHaveLength(1);
  });
});

describe('GET /bookings', () => {
  it('token olmadan 401 döner', async () => {
    const res = await request(app).get('/bookings');
    expect(res.status).toBe(401);
  });

  it('member sadece kendi rezervasyonlarını görür', async () => {
    const memberA = await insertUser('member');
    const memberB = await insertUser('member');
    const room = await insertRoom();
    await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(memberA.id, 'member')}`)
      .send(validPayload(room.id, 0));
    await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(memberB.id, 'member')}`)
      .send(validPayload(room.id, 3));

    const res = await request(app)
      .get('/bookings')
      .set('Authorization', `Bearer ${signToken(memberA.id, 'member')}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(1);
    expect(res.body.bookings[0].userId).toBe(memberA.id);
  });

  it('admin tüm rezervasyonları görür', async () => {
    const memberA = await insertUser('member');
    const memberB = await insertUser('member');
    const admin = await insertUser('admin');
    const room = await insertRoom();
    await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(memberA.id, 'member')}`)
      .send(validPayload(room.id, 0));
    await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(memberB.id, 'member')}`)
      .send(validPayload(room.id, 3));

    const res = await request(app)
      .get('/bookings')
      .set('Authorization', `Bearer ${signToken(admin.id, 'admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(2);
  });

  it('cursor-based pagination doğru şekilde sayfalar', async () => {
    const admin = await insertUser('admin');
    const room = await insertRoom();
    const token = signToken(admin.id, 'admin');
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload(room.id, i * 3));
    }

    const firstPage = await request(app).get('/bookings?limit=2').set('Authorization', `Bearer ${token}`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.bookings).toHaveLength(2);
    expect(typeof firstPage.body.nextCursor).toBe('string');
    // Bölüm 7: cursor sayfa numarası/offset gibi tahmin edilebilir olmamalı.
    expect(firstPage.body.nextCursor).not.toMatch(/^\d+$/);

    const secondPage = await request(app)
      .get(`/bookings?limit=2&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.bookings).toHaveLength(1);
    expect(secondPage.body.nextCursor).toBeNull();

    const firstPageIds = firstPage.body.bookings.map((b: { id: string }) => b.id);
    const secondPageIds = secondPage.body.bookings.map((b: { id: string }) => b.id);
    expect(new Set([...firstPageIds, ...secondPageIds]).size).toBe(3);
  });

  it('geçersiz cursor için 400 döner', async () => {
    const admin = await insertUser('admin');
    const res = await request(app)
      .get('/bookings?cursor=not-valid-base64!!')
      .set('Authorization', `Bearer ${signToken(admin.id, 'admin')}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CURSOR');
  });
});

describe('GET /bookings/:id', () => {
  it('token olmadan 401 döner', async () => {
    const res = await request(app).get(`/bookings/${randomUUID()}`);
    expect(res.status).toBe(401);
  });

  it('geçersiz uuid için 400 döner', async () => {
    const member = await insertUser('member');
    const res = await request(app)
      .get('/bookings/not-a-uuid')
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`);

    expect(res.status).toBe(400);
  });

  it('var olmayan id için 404 döner', async () => {
    const member = await insertUser('member');
    const res = await request(app)
      .get(`/bookings/${randomUUID()}`)
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  it('sahibi kendi rezervasyonunu görebilir (200)', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const token = signToken(member.id, 'member');
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload(room.id));

    const res = await request(app)
      .get(`/bookings/${createRes.body.booking.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.booking.id).toBe(createRes.body.booking.id);
  });

  it('başka bir member\'ın rezervasyonunu istemek 403 döner', async () => {
    const owner = await insertUser('member');
    const intruder = await insertUser('member');
    const room = await insertRoom();
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(owner.id, 'member')}`)
      .send(validPayload(room.id));

    const res = await request(app)
      .get(`/bookings/${createRes.body.booking.id}`)
      .set('Authorization', `Bearer ${signToken(intruder.id, 'member')}`);

    expect(res.status).toBe(403);
  });

  it('admin herhangi bir rezervasyonu görebilir (200)', async () => {
    const owner = await insertUser('member');
    const admin = await insertUser('admin');
    const room = await insertRoom();
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(owner.id, 'member')}`)
      .send(validPayload(room.id));

    const res = await request(app)
      .get(`/bookings/${createRes.body.booking.id}`)
      .set('Authorization', `Bearer ${signToken(admin.id, 'admin')}`);

    expect(res.status).toBe(200);
  });
});

describe('PATCH /bookings/:id/cancel', () => {
  it('token olmadan 401 döner', async () => {
    const res = await request(app).patch(`/bookings/${randomUUID()}/cancel`);
    expect(res.status).toBe(401);
  });

  it('var olmayan id için 404 döner', async () => {
    const member = await insertUser('member');
    const res = await request(app)
      .patch(`/bookings/${randomUUID()}/cancel`)
      .set('Authorization', `Bearer ${signToken(member.id, 'member')}`);

    expect(res.status).toBe(404);
  });

  it('sahibi kendi rezervasyonunu iptal edebilir (200)', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const token = signToken(member.id, 'member');
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload(room.id));

    const res = await request(app)
      .patch(`/bookings/${createRes.body.booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('cancelled');
  });

  it('başka bir member\'ın rezervasyonunu iptal etmeye çalışmak 403 döner', async () => {
    const owner = await insertUser('member');
    const intruder = await insertUser('member');
    const room = await insertRoom();
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(owner.id, 'member')}`)
      .send(validPayload(room.id));

    const res = await request(app)
      .patch(`/bookings/${createRes.body.booking.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(intruder.id, 'member')}`);

    expect(res.status).toBe(403);
  });

  it('admin herhangi bir rezervasyonu iptal edebilir (200)', async () => {
    const owner = await insertUser('member');
    const admin = await insertUser('admin');
    const room = await insertRoom();
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${signToken(owner.id, 'member')}`)
      .send(validPayload(room.id));

    const res = await request(app)
      .patch(`/bookings/${createRes.body.booking.id}/cancel`)
      .set('Authorization', `Bearer ${signToken(admin.id, 'admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('cancelled');
  });

  it('iptal edilen rezervasyonun kapladığı zaman aralığı tekrar rezerve edilebilir', async () => {
    const member = await insertUser('member');
    const room = await insertRoom();
    const token = signToken(member.id, 'member');
    const createRes = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload(room.id, 20));

    await request(app)
      .patch(`/bookings/${createRes.body.booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload(room.id, 20));

    expect(res.status).toBe(201);
  });
});
