import { ApiError } from '../../utils/ApiError.js';
import * as bookingsRepository from '../bookings/bookings.repository.js';
import { doTimeRangesOverlap } from '../bookings/bookings.service.js';
import * as roomsRepository from './rooms.repository.js';
import type { Room } from './rooms.repository.js';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.schema.js';

// Türkiye 2016'dan beri yaz saati uygulaması yapmıyor, bu yüzden Europe/Istanbul
// için UTC+03:00 sabit ofset güvenli bir varsayımdır (Bölüm 20 — availability
// endpoint'inin tarih yorumu). `date` parametresi bu ofsete göre günün başı/sonu
// olarak yorumlanır, sorguda UTC'ye çevrilir.
const ISTANBUL_UTC_OFFSET = '+03:00';

export type FreeSlot = { start: string; end: string };

export async function listActiveRooms(): Promise<Room[]> {
  return roomsRepository.findActiveRooms();
}

export async function getRoomById(id: string): Promise<Room> {
  const room = await roomsRepository.findRoomById(id);
  if (!room) {
    throw new ApiError(404, 'ROOM_NOT_FOUND', 'Oda bulunamadı');
  }
  return room;
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  return roomsRepository.insertRoom(input);
}

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
  const updated = await roomsRepository.updateRoomById(id, input);
  if (!updated) {
    throw new ApiError(404, 'ROOM_NOT_FOUND', 'Oda bulunamadı');
  }
  return updated;
}

export async function getRoomAvailability(id: string, date: string): Promise<FreeSlot[]> {
  await getRoomById(id);

  const dayStart = new Date(`${date}T00:00:00${ISTANBUL_UTC_OFFSET}`);
  const dayEnd = new Date(`${date}T23:59:59.999${ISTANBUL_UTC_OFFSET}`);
  if (Number.isNaN(dayStart.getTime())) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Geçersiz tarih');
  }

  // Repository sorgusu zaten sadece o günü kesişen rezervasyonları getiriyor;
  // saf çakışma fonksiyonuyla (Bölüm 12) tekrar süzmek, sorgunun mantığından
  // bağımsız bir doğrulama katmanı ekliyor (defense in depth).
  const dayBookings = (await bookingsRepository.findActiveBookingsForRoomInRange(id, dayStart, dayEnd)).filter(
    (booking) => doTimeRangesOverlap(booking.startsAt, booking.endsAt, dayStart, dayEnd),
  );

  // Exclusion constraint (Bölüm 6) aynı oda için çakışan rezervasyonu imkansız
  // kıldığından bu rezervasyonlar birbiriyle asla örtüşmez — sıralı, aralarındaki
  // boşlukları toplayan basit bir tarama yeterlidir.
  const freeSlots: FreeSlot[] = [];
  let cursor = dayStart;
  for (const booking of dayBookings) {
    const bookingStart = booking.startsAt < dayStart ? dayStart : booking.startsAt;
    const bookingEnd = booking.endsAt > dayEnd ? dayEnd : booking.endsAt;
    if (bookingStart > cursor) {
      freeSlots.push({ start: cursor.toISOString(), end: bookingStart.toISOString() });
    }
    if (bookingEnd > cursor) {
      cursor = bookingEnd;
    }
  }
  if (cursor < dayEnd) {
    freeSlots.push({ start: cursor.toISOString(), end: dayEnd.toISOString() });
  }

  return freeSlots;
}

export async function deactivateRoom(id: string): Promise<Room> {
  const updated = await roomsRepository.deactivateRoomById(id);
  if (!updated) {
    throw new ApiError(404, 'ROOM_NOT_FOUND', 'Oda bulunamadı');
  }
  return updated;
}
