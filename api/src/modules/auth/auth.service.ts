import { createHash, randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { ApiError } from '../../utils/ApiError.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const ACCESS_TOKEN_TTL = '15m';
// Spec (Bölüm 11) refresh token'ın ömrünü belirtmiyor, sadece rotasyonlu olduğunu
// söylüyor. 7 gün, bu proje ölçeği için makul/standart bir varsayım olarak seçildi.
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PublicUser = {
  id: string;
  email: string;
  role: 'member' | 'admin';
  createdAt: Date;
};

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresInMs: number;
};

function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefreshToken(userId: string): string {
  // jti: aynı saniye içinde art arda üretilen refresh token'ların (iat çözünürlüğü
  // saniye olduğu için) birebir aynı çıkmasını önler — rotasyonun her zaman
  // gerçekten yeni/farklı bir token üretmesini garanti eder.
  return jwt.sign({ sub: userId, jti: randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export async function register(input: RegisterInput): Promise<PublicUser> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'Bu e-posta adresi zaten kayıtlı');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const [created] = await db
    .insert(users)
    .values({ email: input.email, passwordHash, role: 'member' })
    .returning();

  if (!created) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Kullanıcı oluşturulamadı');
  }

  return toPublicUser(created);
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre yanlış');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre yanlış');
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);

  await db
    .update(users)
    .set({ refreshTokenHash: hashRefreshToken(refreshToken) })
    .where(eq(users.id, user.id));

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
    refreshTokenExpiresInMs: REFRESH_TOKEN_TTL_MS,
  };
}

export async function refresh(presentedToken: string | undefined): Promise<AuthResult> {
  if (!presentedToken) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token bulunamadı');
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(presentedToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
  } catch {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token geçersiz veya süresi dolmuş');
  }

  const userId = payload.sub;
  if (typeof userId !== 'string') {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token geçersiz');
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.refreshTokenHash || user.refreshTokenHash !== hashRefreshToken(presentedToken)) {
    // Token, DB'deki güncel (rotasyonlanmış) hash ile eşleşmiyor: token
    // ya zaten kullanılıp rotasyonlanmış (replay) ya da logout ile geçersizleşmiş.
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token geçersiz veya süresi dolmuş');
  }

  const accessToken = signAccessToken(user.id, user.role);
  const newRefreshToken = signRefreshToken(user.id);

  await db
    .update(users)
    .set({ refreshTokenHash: hashRefreshToken(newRefreshToken) })
    .where(eq(users.id, user.id));

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken: newRefreshToken,
    refreshTokenExpiresInMs: REFRESH_TOKEN_TTL_MS,
  };
}

export async function logout(userId: string): Promise<void> {
  await db.update(users).set({ refreshTokenHash: null }).where(eq(users.id, userId));
}
