import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  password: z.string().min(1, 'Şifre gerekli'),
});
export type LoginInput = z.infer<typeof loginSchema>;
