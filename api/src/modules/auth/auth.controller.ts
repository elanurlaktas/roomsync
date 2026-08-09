import type { CookieOptions, Request, Response } from 'express';

import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import * as authService from './auth.service.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

function refreshCookieOptions(maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
  };
}

export async function handleRegister(req: Request, res: Response): Promise<void> {
  const user = await authService.register(req.body as RegisterInput);
  res.status(201).json({ user });
}

export async function handleLogin(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresInMs));
  res.status(200).json({ user: result.user, accessToken: result.accessToken });
}

export async function handleRefresh(req: Request, res: Response): Promise<void> {
  const presentedToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const result = await authService.refresh(presentedToken);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresInMs));
  res.status(200).json({ user: result.user, accessToken: result.accessToken });
}

export async function handleLogout(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Erişim token\'ı bulunamadı');
  }
  await authService.logout(req.user.id);
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.status(204).send();
}
