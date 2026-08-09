import { z } from 'zod';

export const bookingIdParamSchema = z.object({
  id: z.string().uuid('Geçersiz rezervasyon id'),
});
export type BookingIdParam = z.infer<typeof bookingIdParamSchema>;

export const createBookingSchema = z
  .object({
    roomId: z.string().uuid('Geçersiz oda id'),
    title: z.string().min(1, 'Başlık gerekli'),
    // Opsiyonel — panelde boş bırakılırsa "" gelebilir, bu durumda undefined'a
    // (yani DB'de null'a) normalize edilir.
    department: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().trim().max(200, 'Departman en fazla 200 karakter olabilir').optional(),
    ),
    startsAt: z.coerce.date({ errorMap: () => ({ message: 'Geçerli bir başlangıç zamanı girin' }) }),
    endsAt: z.coerce.date({ errorMap: () => ({ message: 'Geçerli bir bitiş zamanı girin' }) }),
  })
  // Bölüm 5: ends_at > starts_at kontrolü uygulama katmanında da olsun (DB'deki
  // CHECK constraint'e ek bir güvenlik ağı, daha erken/temiz bir 400 için).
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'Bitiş zamanı başlangıç zamanından sonra olmalı',
    path: ['endsAt'],
  });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const listBookingsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
