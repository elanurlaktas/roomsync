import { z } from 'zod';

import { bookingIdParamSchema, createBookingSchema, listBookingsQuerySchema } from '../modules/bookings/bookings.schema.js';
import { loginSchema, registerSchema } from '../modules/auth/auth.schema.js';
import {
  availabilityQuerySchema,
  createRoomSchema,
  roomIdParamSchema,
  updateRoomSchema,
} from '../modules/rooms/rooms.schema.js';
import { BEARER_AUTH, registry } from './registry.js';
import { bookingResponseSchema, errorResponseSchema, freeSlotSchema, roomResponseSchema, userResponseSchema } from './schemas.js';

// Bu dosya, uygulamayı tamamen yeniden yazmadan mevcut route/controller
// davranışını (bkz. modules/*/[.routes|.controller].ts) OpenAPI path'lerine
// tercüme eder. Sadece register edilir — import edilmesinin tek amacı bu
// yan etki (bkz. docs/openapi.ts).

function jsonBody<T extends z.ZodTypeAny>(schema: T) {
  return { content: { 'application/json': { schema } } };
}

function errorResponse(description: string) {
  return { description, content: { 'application/json': { schema: errorResponseSchema } } };
}

const UNAUTHORIZED = errorResponse("Erişim token'ı eksik, geçersiz veya süresi dolmuş");
const FORBIDDEN = errorResponse('Bu işlem için yetkiniz yok');
const VALIDATION_ERROR = errorResponse('Geçersiz istek verisi (Zod validation)');
const RATE_LIMITED = errorResponse('Çok fazla istek gönderildi');

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Servisin çalıştığını doğrular (auth gerekmez)',
  responses: {
    200: {
      description: 'Servis çalışıyor',
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
    },
  },
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  tags: ['Auth'],
  summary: 'Yeni kullanıcı kaydı (rol her zaman member)',
  request: { body: jsonBody(registerSchema) },
  responses: {
    201: {
      description: 'Kullanıcı oluşturuldu',
      content: { 'application/json': { schema: z.object({ user: userResponseSchema }) } },
    },
    400: VALIDATION_ERROR,
    409: errorResponse('Bu e-posta adresi zaten kayıtlı (EMAIL_TAKEN)'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Giriş yapar; access token gövdede, refresh token HttpOnly cookie\'de döner',
  request: { body: jsonBody(loginSchema) },
  responses: {
    200: {
      description: 'Giriş başarılı',
      content: {
        'application/json': { schema: z.object({ user: userResponseSchema, accessToken: z.string() }) },
      },
      headers: z.object({
        'Set-Cookie': z.string().openapi({ description: 'refreshToken=...; HttpOnly; SameSite=Lax|None' }),
      }),
    },
    400: VALIDATION_ERROR,
    401: errorResponse('E-posta veya şifre yanlış (INVALID_CREDENTIALS)'),
    429: RATE_LIMITED,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Refresh cookie ile yeni bir access token üretir (refresh token rotasyonlu)',
  responses: {
    200: {
      description: 'Yeni access token üretildi',
      content: {
        'application/json': { schema: z.object({ user: userResponseSchema, accessToken: z.string() }) },
      },
    },
    401: errorResponse('Refresh token bulunamadı, geçersiz veya süresi dolmuş (INVALID_REFRESH_TOKEN)'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Oturumu kapatır, refresh token\'ı geçersiz kılar',
  security: [{ [BEARER_AUTH]: [] }],
  responses: {
    204: { description: 'Çıkış yapıldı (gövde yok)' },
    401: UNAUTHORIZED,
  },
});

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/rooms',
  tags: ['Rooms'],
  summary: 'Aktif odaları listeler (member veya admin)',
  security: [{ [BEARER_AUTH]: [] }],
  responses: {
    200: {
      description: 'Oda listesi',
      content: { 'application/json': { schema: z.object({ rooms: z.array(roomResponseSchema) }) } },
    },
    401: UNAUTHORIZED,
  },
});

registry.registerPath({
  method: 'post',
  path: '/rooms',
  tags: ['Rooms'],
  summary: 'Yeni oda oluşturur (sadece admin)',
  security: [{ [BEARER_AUTH]: [] }],
  request: { body: jsonBody(createRoomSchema) },
  responses: {
    201: {
      description: 'Oda oluşturuldu',
      content: { 'application/json': { schema: z.object({ room: roomResponseSchema }) } },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    403: FORBIDDEN,
  },
});

registry.registerPath({
  method: 'get',
  path: '/rooms/{id}',
  tags: ['Rooms'],
  summary: 'Tek bir odayı getirir',
  security: [{ [BEARER_AUTH]: [] }],
  request: { params: roomIdParamSchema },
  responses: {
    200: {
      description: 'Oda bulundu',
      content: { 'application/json': { schema: z.object({ room: roomResponseSchema }) } },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    404: errorResponse('Oda bulunamadı (ROOM_NOT_FOUND)'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/rooms/{id}',
  tags: ['Rooms'],
  summary: 'Odayı günceller (sadece admin)',
  security: [{ [BEARER_AUTH]: [] }],
  request: { params: roomIdParamSchema, body: jsonBody(updateRoomSchema) },
  responses: {
    200: {
      description: 'Oda güncellendi',
      content: { 'application/json': { schema: z.object({ room: roomResponseSchema }) } },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: errorResponse('Oda bulunamadı (ROOM_NOT_FOUND)'),
  },
});

registry.registerPath({
  method: 'delete',
  path: '/rooms/{id}',
  tags: ['Rooms'],
  summary: 'Odayı pasifleştirir (soft delete, sadece admin)',
  security: [{ [BEARER_AUTH]: [] }],
  request: { params: roomIdParamSchema },
  responses: {
    204: { description: 'Oda pasifleştirildi (gövde yok)' },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    403: FORBIDDEN,
    404: errorResponse('Oda bulunamadı (ROOM_NOT_FOUND)'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/rooms/{id}/availability',
  tags: ['Rooms'],
  summary: 'Belirtilen gün için boş saat aralıklarını döner (Europe/Istanbul yorumlu)',
  security: [{ [BEARER_AUTH]: [] }],
  request: { params: roomIdParamSchema, query: availabilityQuerySchema },
  responses: {
    200: {
      description: 'O günün boş saat aralıkları',
      content: {
        'application/json': {
          schema: z.object({
            roomId: z.string().uuid(),
            date: z.string(),
            freeSlots: z.array(freeSlotSchema),
          }),
        },
      },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    404: errorResponse('Oda bulunamadı (ROOM_NOT_FOUND)'),
  },
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

registry.registerPath({
  method: 'get',
  path: '/bookings',
  tags: ['Bookings'],
  summary: "Rezervasyonları listeler (member sadece kendisininkileri, admin hepsini; cursor-based pagination)",
  security: [{ [BEARER_AUTH]: [] }],
  request: { query: listBookingsQuerySchema },
  responses: {
    200: {
      description: 'Rezervasyon sayfası',
      content: {
        'application/json': {
          schema: z.object({
            bookings: z.array(bookingResponseSchema),
            nextCursor: z.string().nullable().openapi({
              description: 'Bir sonraki sayfa için opak cursor; son sayfadaysa null',
            }),
          }),
        },
      },
    },
    400: errorResponse('Geçersiz pagination cursor (INVALID_CURSOR) veya validation hatası'),
    401: UNAUTHORIZED,
  },
});

registry.registerPath({
  method: 'post',
  path: '/bookings',
  tags: ['Bookings'],
  summary: 'Yeni rezervasyon oluşturur; çakışan rezervasyon 409 döner',
  security: [{ [BEARER_AUTH]: [] }],
  request: { body: jsonBody(createBookingSchema) },
  responses: {
    201: {
      description: 'Rezervasyon oluşturuldu',
      content: { 'application/json': { schema: z.object({ booking: bookingResponseSchema }) } },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    404: errorResponse('Oda bulunamadı (ROOM_NOT_FOUND)'),
    409: errorResponse('Oda o saat aralığında dolu (BOOKING_CONFLICT) veya pasif (ROOM_INACTIVE)'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/bookings/{id}',
  tags: ['Bookings'],
  summary: 'Tek bir rezervasyonu getirir (member sadece kendisininkini görebilir)',
  security: [{ [BEARER_AUTH]: [] }],
  request: { params: bookingIdParamSchema },
  responses: {
    200: {
      description: 'Rezervasyon bulundu',
      content: { 'application/json': { schema: z.object({ booking: bookingResponseSchema }) } },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    403: errorResponse('Başkasının rezervasyonu görüntülenemez'),
    404: errorResponse('Rezervasyon bulunamadı (BOOKING_NOT_FOUND)'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/bookings/{id}/cancel',
  tags: ['Bookings'],
  summary: 'Rezervasyonu iptal eder (sahibi veya admin)',
  security: [{ [BEARER_AUTH]: [] }],
  request: { params: bookingIdParamSchema },
  responses: {
    200: {
      description: 'Rezervasyon iptal edildi',
      content: { 'application/json': { schema: z.object({ booking: bookingResponseSchema }) } },
    },
    400: VALIDATION_ERROR,
    401: UNAUTHORIZED,
    403: errorResponse('Başkasının rezervasyonu iptal edilemez'),
    404: errorResponse('Rezervasyon bulunamadı (BOOKING_NOT_FOUND)'),
  },
});
