import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedUser } from '../types/express.js';

interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  role: 'member' | 'admin';
}

function isAccessTokenPayload(payload: jwt.JwtPayload | string): payload is AccessTokenPayload {
  return (
    typeof payload === 'object' &&
    typeof payload.sub === 'string' &&
    (payload.role === 'member' || payload.role === 'admin')
  );
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new ApiError(401, 'UNAUTHORIZED', 'Erişim token\'ı bulunamadı'));
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (!isAccessTokenPayload(payload)) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Erişim token\'ı geçersiz'));
      return;
    }
    const user: AuthenticatedUser = { id: payload.sub, role: payload.role };
    req.user = user;
    next();
  } catch {
    next(new ApiError(401, 'UNAUTHORIZED', 'Erişim token\'ı geçersiz veya süresi dolmuş'));
  }
}

export function requireRole(...allowedRoles: AuthenticatedUser['role'][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, 'UNAUTHORIZED', 'Erişim token\'ı bulunamadı'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new ApiError(403, 'FORBIDDEN', 'Bu işlem için yetkiniz yok'));
      return;
    }
    next();
  };
}
