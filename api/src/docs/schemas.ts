import { z } from 'zod';

import { registry } from './registry.js';

// Bu dosyadaki şemalar, ilgili modüllerin gerçek dönüş tiplerini (bkz.
// auth.service.ts PublicUser, rooms.repository.ts Room, bookings.repository.ts
// Booking) OpenAPI/Swagger UI için tekrar tanımlar. Bilinçli bir tekrar: request
// şemaları (register/login/createRoom vb.) zaten ilgili `*.schema.ts`
// dosyalarından yeniden kullanılıyor, ama response tipleri için ayrı Zod şeması
// yoktu — burada sadece dokümantasyon amaçlı, DB'ye dokunmayan salt-okunur
// şemalar tanımlanıyor.

export const userResponseSchema = registry.register(
  'User',
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(['member', 'admin']),
    createdAt: z.coerce.string().datetime(),
  }),
);

export const roomResponseSchema = registry.register(
  'Room',
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    capacity: z.number().int(),
    location: z.string(),
    isActive: z.boolean(),
    createdAt: z.coerce.string().datetime(),
  }),
);

export const bookingResponseSchema = registry.register(
  'Booking',
  z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    roomId: z.string().uuid(),
    title: z.string(),
    department: z.string().nullable().openapi({ example: 'Mühendislik' }),
    startsAt: z.coerce.string().datetime(),
    endsAt: z.coerce.string().datetime(),
    status: z.enum(['confirmed', 'cancelled']),
    createdAt: z.coerce.string().datetime(),
  }),
);

export const freeSlotSchema = registry.register(
  'FreeSlot',
  z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
);

// Bölüm 20 — tüm endpoint'lerde tek tip hata formatı: { error: { code, message, details? } }.
export const errorResponseSchema = registry.register(
  'ErrorResponse',
  z.object({
    error: z.object({
      code: z.string().openapi({ example: 'VALIDATION_ERROR' }),
      message: z.string().openapi({ example: 'İnsan tarafından okunabilir mesaj' }),
      details: z.record(z.unknown()).optional(),
    }),
  }),
);
