import * as roomsRepository from '../rooms/rooms.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import type { AuthenticatedUser } from '../../types/express.js';
import * as bookingsRepository from './bookings.repository.js';
import type { Booking } from './bookings.repository.js';
import type { CreateBookingInput } from './bookings.schema.js';

// PostgreSQL exclusion constraint ihlali (Bölüm 6) — `bookings_no_overlap`.
const POSTGRES_EXCLUSION_VIOLATION = '23P01';

// Bölüm 6: iki zaman aralığı çakışır ⟺ start_a < end_b AND start_b < end_a.
// Repository'deki SQL sorgusuyla birebir aynı mantığı uygulayan, DB'den bağımsız
// saf fonksiyon — birim testle doğrulanabilir (Bölüm 12).
export function doTimeRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isPostgresError(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export async function createBooking(userId: string, input: CreateBookingInput): Promise<Booking> {
  const room = await roomsRepository.findRoomById(input.roomId);
  if (!room) {
    throw new ApiError(404, 'ROOM_NOT_FOUND', 'Oda bulunamadı');
  }
  if (!room.isActive) {
    throw new ApiError(409, 'ROOM_INACTIVE', 'Bu oda artık aktif değil, rezerve edilemez');
  }

  // 1. katman (Bölüm 6) — hızlı, kullanıcı dostu 409 için uygulama seviyesinde kontrol.
  const overlapping = await bookingsRepository.findOverlappingBooking(
    input.roomId,
    input.startsAt,
    input.endsAt,
  );
  if (overlapping) {
    throw new ApiError(409, 'BOOKING_CONFLICT', 'Bu oda seçilen zaman aralığında zaten rezerve edilmiş');
  }

  try {
    return await bookingsRepository.insertBooking(userId, input);
  } catch (error) {
    // 2. katman (Bölüm 6) — asıl doğruluk garantisi. Uygulama katmanı kontrolü
    // geçse bile eşzamanlı iki istek arasındaki race condition burada yakalanır.
    if (isPostgresError(error) && error.code === POSTGRES_EXCLUSION_VIOLATION) {
      throw new ApiError(409, 'BOOKING_CONFLICT', 'Bu oda seçilen zaman aralığında zaten rezerve edilmiş');
    }
    throw error;
  }
}

export async function getBookingById(
  userId: string,
  role: AuthenticatedUser['role'],
  id: string,
): Promise<Booking> {
  const booking = await bookingsRepository.findBookingById(id);
  if (!booking) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Rezervasyon bulunamadı');
  }
  if (role !== 'admin' && booking.userId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Bu rezervasyonu görüntüleme yetkiniz yok');
  }
  return booking;
}

export async function cancelBooking(
  userId: string,
  role: AuthenticatedUser['role'],
  id: string,
): Promise<Booking> {
  const booking = await bookingsRepository.findBookingById(id);
  if (!booking) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Rezervasyon bulunamadı');
  }
  if (role !== 'admin' && booking.userId !== userId) {
    throw new ApiError(403, 'FORBIDDEN', 'Bu rezervasyonu iptal etme yetkiniz yok');
  }

  const cancelled = await bookingsRepository.cancelBookingById(id);
  if (!cancelled) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', 'Rezervasyon bulunamadı');
  }
  return cancelled;
}

type BookingCursorPayload = { createdAt: string; id: string };

// Bölüm 7: cursor, created_at + id'den türetilmiş opak (base64) bir string
// olmalı — sayfa numarası/offset gibi tahmin edilebilir bir değer olmamalı.
function encodeCursor(booking: Pick<Booking, 'createdAt' | 'id'>): string {
  const payload: BookingCursorPayload = { createdAt: booking.createdAt.toISOString(), id: booking.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof (decoded as BookingCursorPayload).createdAt === 'string' &&
      typeof (decoded as BookingCursorPayload).id === 'string'
    ) {
      const createdAt = new Date((decoded as BookingCursorPayload).createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('invalid createdAt');
      }
      return { createdAt, id: (decoded as BookingCursorPayload).id };
    }
    throw new Error('invalid cursor shape');
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'Geçersiz pagination cursor');
  }
}

export async function listBookings(
  userId: string,
  role: AuthenticatedUser['role'],
  options: { cursor?: string; limit: number },
): Promise<{ bookings: Booking[]; nextCursor: string | null }> {
  const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;

  const rows = await bookingsRepository.listBookings({
    userId: role === 'admin' ? undefined : userId,
    limit: options.limit + 1,
    cursor,
  });

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last) : null;

  return { bookings: page, nextCursor };
}
