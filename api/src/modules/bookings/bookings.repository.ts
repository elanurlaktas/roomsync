import { and, desc, eq, gt, lt, ne, or } from 'drizzle-orm';

import { db } from '../../db/index.js';
import { bookings } from '../../db/schema.js';
import type { CreateBookingInput } from './bookings.schema.js';

export type Booking = typeof bookings.$inferSelect;
export type BookingCursor = { createdAt: Date; id: string };

// İki zaman aralığı çakışır ⟺ start_a < end_b AND start_b < end_a (Bölüm 6).
function overlapsCondition(roomId: string, startsAt: Date, endsAt: Date) {
  return and(
    eq(bookings.roomId, roomId),
    ne(bookings.status, 'cancelled'),
    lt(bookings.startsAt, endsAt),
    gt(bookings.endsAt, startsAt),
  );
}

export async function findOverlappingBooking(
  roomId: string,
  startsAt: Date,
  endsAt: Date,
): Promise<Booking | undefined> {
  return db.query.bookings.findFirst({ where: overlapsCondition(roomId, startsAt, endsAt) });
}

export async function insertBooking(userId: string, input: CreateBookingInput): Promise<Booking> {
  const [created] = await db
    .insert(bookings)
    .values({
      userId,
      roomId: input.roomId,
      title: input.title,
      department: input.department,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    })
    .returning();
  if (!created) {
    throw new Error('Rezervasyon oluşturulamadı');
  }
  return created;
}

export async function findBookingById(id: string): Promise<Booking | undefined> {
  return db.query.bookings.findFirst({ where: eq(bookings.id, id) });
}

export async function cancelBookingById(id: string): Promise<Booking | undefined> {
  const [updated] = await db
    .update(bookings)
    .set({ status: 'cancelled' })
    .where(eq(bookings.id, id))
    .returning();
  return updated;
}

export async function listBookings(params: {
  userId?: string;
  limit: number;
  cursor?: BookingCursor;
}): Promise<Booking[]> {
  const conditions = [];
  if (params.userId) {
    conditions.push(eq(bookings.userId, params.userId));
  }
  if (params.cursor) {
    // Keyset pagination: created_at DESC, id DESC sıralamasında cursor'dan
    // "sonraki" (daha eski) kayıtlar (Bölüm 7 — opak, tahmin edilemez cursor).
    const { createdAt, id } = params.cursor;
    conditions.push(
      or(lt(bookings.createdAt, createdAt), and(eq(bookings.createdAt, createdAt), lt(bookings.id, id))),
    );
  }

  return db.query.bookings.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(bookings.createdAt), desc(bookings.id)],
    limit: params.limit,
  });
}

export async function findActiveBookingsForRoomInRange(
  roomId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Booking[]> {
  return db.query.bookings.findMany({
    where: and(
      eq(bookings.roomId, roomId),
      ne(bookings.status, 'cancelled'),
      lt(bookings.startsAt, rangeEnd),
      gt(bookings.endsAt, rangeStart),
    ),
    orderBy: (booking, { asc }) => asc(booking.startsAt),
  });
}
