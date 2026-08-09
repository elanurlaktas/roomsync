import { randomUUID } from 'node:crypto';

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

// Admin oluşturma endpoint'i yok (Bölüm 5 — rol DB'den elle atanır); testlerde
// admin token'ı doğrudan imzalanır, gerçek register/login akışıyla değil.
function signToken(role: 'member' | 'admin'): string {
  return jwt.sign({ sub: randomUUID(), role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

async function insertRoom(overrides: Partial<typeof rooms.$inferInsert> = {}) {
  const [room] = await db
    .insert(rooms)
    .values({
      name: 'Toplantı Odası A',
      capacity: 8,
      location: '3. Kat',
      ...overrides,
    })
    .returning();
  if (!room) throw new Error('test fixture oluşturulamadı');
  return room;
}

async function insertUser() {
  const [user] = await db
    .insert(users)
    .values({ email: `${randomUUID()}@roomsync.dev`, passwordHash: 'irrelevant-for-these-tests', role: 'member' })
    .returning();
  if (!user) throw new Error('test fixture oluşturulamadı');
  return user;
}

async function insertBooking(overrides: Partial<typeof bookings.$inferInsert> & { roomId: string; userId: string }) {
  const [booking] = await db
    .insert(bookings)
    .values({ title: 'Rezervasyon', ...overrides })
    .returning();
  if (!booking) throw new Error('test fixture oluşturulamadı');
  return booking;
}

const validRoomInput = { name: 'Toplantı Odası B', capacity: 6, location: '2. Kat' };

describe('GET /rooms', () => {
  it('token olmadan 401 döner', async () => {
    const res = await request(app).get('/rooms');
    expect(res.status).toBe(401);
  });

  it('sadece aktif odaları listeler (200)', async () => {
    const active = await insertRoom({ name: 'Aktif Oda' });
    await insertRoom({ name: 'Pasif Oda', isActive: false });

    const res = await request(app).get('/rooms').set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(1);
    expect(res.body.rooms[0].id).toBe(active.id);
  });
});

describe('GET /rooms/:id', () => {
  it('token olmadan 401 döner', async () => {
    const room = await insertRoom();
    const res = await request(app).get(`/rooms/${room.id}`);
    expect(res.status).toBe(401);
  });

  it('geçerli id ile odayı döner (200)', async () => {
    const room = await insertRoom();
    const res = await request(app).get(`/rooms/${room.id}`).set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(200);
    expect(res.body.room).toMatchObject({ id: room.id, name: room.name });
  });

  it('geçersiz uuid formatında 400 döner', async () => {
    const res = await request(app)
      .get('/rooms/not-a-uuid')
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('var olmayan id için 404 döner', async () => {
    const res = await request(app)
      .get(`/rooms/${randomUUID()}`)
      .set('Authorization', `Bearer ${signToken('admin')}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
  });
});

describe('POST /rooms', () => {
  it('token olmadan 401 döner', async () => {
    const res = await request(app).post('/rooms').send(validRoomInput);
    expect(res.status).toBe(401);
  });

  it('member rolüyle 403 döner', async () => {
    const res = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${signToken('member')}`)
      .send(validRoomInput);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('admin rolüyle oda oluşturur (201)', async () => {
    const res = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${signToken('admin')}`)
      .send(validRoomInput);

    expect(res.status).toBe(201);
    expect(res.body.room).toMatchObject({ ...validRoomInput, isActive: true });
  });

  it('geçersiz input için 400 döner', async () => {
    const res = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${signToken('admin')}`)
      .send({ name: '', capacity: -1, location: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /rooms/:id', () => {
  it('token olmadan 401 döner', async () => {
    const room = await insertRoom();
    const res = await request(app).patch(`/rooms/${room.id}`).send({ name: 'Yeni İsim' });
    expect(res.status).toBe(401);
  });

  it('member rolüyle 403 döner', async () => {
    const room = await insertRoom();
    const res = await request(app)
      .patch(`/rooms/${room.id}`)
      .set('Authorization', `Bearer ${signToken('member')}`)
      .send({ name: 'Yeni İsim' });

    expect(res.status).toBe(403);
  });

  it('admin rolüyle günceller (200)', async () => {
    const room = await insertRoom();
    const res = await request(app)
      .patch(`/rooms/${room.id}`)
      .set('Authorization', `Bearer ${signToken('admin')}`)
      .send({ name: 'Güncellenmiş Oda', capacity: 12 });

    expect(res.status).toBe(200);
    expect(res.body.room).toMatchObject({ id: room.id, name: 'Güncellenmiş Oda', capacity: 12 });
  });

  it('boş body için 400 döner', async () => {
    const room = await insertRoom();
    const res = await request(app)
      .patch(`/rooms/${room.id}`)
      .set('Authorization', `Bearer ${signToken('admin')}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('var olmayan id için 404 döner', async () => {
    const res = await request(app)
      .patch(`/rooms/${randomUUID()}`)
      .set('Authorization', `Bearer ${signToken('admin')}`)
      .send({ name: 'Yeni İsim' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /rooms/:id', () => {
  it('token olmadan 401 döner', async () => {
    const room = await insertRoom();
    const res = await request(app).delete(`/rooms/${room.id}`);
    expect(res.status).toBe(401);
  });

  it('member rolüyle 403 döner', async () => {
    const room = await insertRoom();
    const res = await request(app)
      .delete(`/rooms/${room.id}`)
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(403);
  });

  it('admin rolüyle soft delete yapar (204) ve oda listede görünmez olur', async () => {
    const room = await insertRoom();
    const deleteRes = await request(app)
      .delete(`/rooms/${room.id}`)
      .set('Authorization', `Bearer ${signToken('admin')}`);

    expect(deleteRes.status).toBe(204);

    const listRes = await request(app).get('/rooms').set('Authorization', `Bearer ${signToken('admin')}`);
    expect(listRes.body.rooms.find((r: { id: string }) => r.id === room.id)).toBeUndefined();
  });

  it('var olmayan id için 404 döner', async () => {
    const res = await request(app)
      .delete(`/rooms/${randomUUID()}`)
      .set('Authorization', `Bearer ${signToken('admin')}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /rooms/:id/availability', () => {
  it('token olmadan 401 döner', async () => {
    const room = await insertRoom();
    const res = await request(app).get(`/rooms/${room.id}/availability?date=2026-09-01`);
    expect(res.status).toBe(401);
  });

  it('geçersiz tarih formatı için 400 döner', async () => {
    const room = await insertRoom();
    const res = await request(app)
      .get(`/rooms/${room.id}/availability?date=01-09-2026`)
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('var olmayan oda için 404 döner', async () => {
    const res = await request(app)
      .get(`/rooms/${randomUUID()}/availability?date=2026-09-01`)
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(404);
  });

  it('rezervasyon yoksa tüm günü boş döner', async () => {
    const room = await insertRoom();
    const res = await request(app)
      .get(`/rooms/${room.id}/availability?date=2026-09-01`)
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(200);
    expect(res.body.freeSlots).toHaveLength(1);
    expect(res.body.freeSlots[0]).toMatchObject({
      start: '2026-08-31T21:00:00.000Z',
      end: '2026-09-01T20:59:59.999Z',
    });
  });

  it('bir rezervasyon varsa öncesi ve sonrasını boş olarak döner', async () => {
    const room = await insertRoom();
    const user = await insertUser();
    // Europe/Istanbul (UTC+03:00) 10:00–11:00 -> UTC 07:00–08:00.
    await insertBooking({
      roomId: room.id,
      userId: user.id,
      startsAt: new Date('2026-09-01T07:00:00.000Z'),
      endsAt: new Date('2026-09-01T08:00:00.000Z'),
    });

    const res = await request(app)
      .get(`/rooms/${room.id}/availability?date=2026-09-01`)
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(200);
    expect(res.body.freeSlots).toEqual([
      { start: '2026-08-31T21:00:00.000Z', end: '2026-09-01T07:00:00.000Z' },
      { start: '2026-09-01T08:00:00.000Z', end: '2026-09-01T20:59:59.999Z' },
    ]);
  });

  it('iptal edilmiş rezervasyonu boş saat olarak sayar', async () => {
    const room = await insertRoom();
    const user = await insertUser();
    await insertBooking({
      roomId: room.id,
      userId: user.id,
      startsAt: new Date('2026-09-01T07:00:00.000Z'),
      endsAt: new Date('2026-09-01T08:00:00.000Z'),
      status: 'cancelled',
    });

    const res = await request(app)
      .get(`/rooms/${room.id}/availability?date=2026-09-01`)
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(200);
    expect(res.body.freeSlots).toHaveLength(1);
  });

  it('başka bir güne ait rezervasyonu görmezden gelir', async () => {
    const room = await insertRoom();
    const user = await insertUser();
    await insertBooking({
      roomId: room.id,
      userId: user.id,
      startsAt: new Date('2026-09-02T07:00:00.000Z'),
      endsAt: new Date('2026-09-02T08:00:00.000Z'),
    });

    const res = await request(app)
      .get(`/rooms/${room.id}/availability?date=2026-09-01`)
      .set('Authorization', `Bearer ${signToken('member')}`);

    expect(res.status).toBe(200);
    expect(res.body.freeSlots).toHaveLength(1);
  });
});
