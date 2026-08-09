import { eq } from 'drizzle-orm';

import { db } from '../../db/index.js';
import { rooms } from '../../db/schema.js';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.schema.js';

export type Room = typeof rooms.$inferSelect;

export async function findActiveRooms(): Promise<Room[]> {
  return db.query.rooms.findMany({
    where: eq(rooms.isActive, true),
    orderBy: (room, { asc }) => asc(room.name),
  });
}

export async function findRoomById(id: string): Promise<Room | undefined> {
  return db.query.rooms.findFirst({ where: eq(rooms.id, id) });
}

export async function insertRoom(input: CreateRoomInput): Promise<Room> {
  const [created] = await db.insert(rooms).values(input).returning();
  if (!created) {
    throw new Error('Oda oluşturulamadı');
  }
  return created;
}

export async function updateRoomById(id: string, input: UpdateRoomInput): Promise<Room | undefined> {
  const [updated] = await db.update(rooms).set(input).where(eq(rooms.id, id)).returning();
  return updated;
}

export async function deactivateRoomById(id: string): Promise<Room | undefined> {
  const [updated] = await db
    .update(rooms)
    .set({ isActive: false })
    .where(eq(rooms.id, id))
    .returning();
  return updated;
}
