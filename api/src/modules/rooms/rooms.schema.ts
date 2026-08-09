import { z } from 'zod';

export const roomIdParamSchema = z.object({
  id: z.string().uuid('Geçersiz oda id'),
});
export type RoomIdParam = z.infer<typeof roomIdParamSchema>;

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Oda adı gerekli'),
  capacity: z.coerce.number().int().positive('Kapasite pozitif bir sayı olmalı'),
  location: z.string().min(1, 'Konum gerekli'),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date parametresi YYYY-MM-DD formatında olmalı (örn. 2026-08-10)'),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const updateRoomSchema = z
  .object({
    name: z.string().min(1, 'Oda adı gerekli').optional(),
    capacity: z.coerce.number().int().positive('Kapasite pozitif bir sayı olmalı').optional(),
    location: z.string().min(1, 'Konum gerekli').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Güncellemek için en az bir alan gerekli',
  });
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
