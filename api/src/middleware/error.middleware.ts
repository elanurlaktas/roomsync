import type { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.originalUrl} bulunamadı` },
  });
}

// express.json() (body-parser) geçersiz JSON gövdesinde bir SyntaxError fırlatır ve
// bunu `status: 400` ile next(err) çağırarak buraya iletir. Bunu yakalamazsak
// 500 INTERNAL_ERROR olarak sızar; oysa bu istemci kaynaklı bir hata (400).
function isMalformedJsonError(error: unknown): error is SyntaxError & { status: number } {
  return error instanceof SyntaxError && 'status' in error && (error as { status?: unknown }).status === 400;
}

// Express bu imzayı (4 parametre) hata middleware'i olarak tanır; _next kullanılmasa
// da imzadan çıkarılamaz.
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }

  if (isMalformedJsonError(error)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Geçersiz JSON gövdesi' },
    });
    return;
  }

  logger.error(error, 'Beklenmeyen hata');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Beklenmeyen bir sunucu hatası oluştu' },
  });
}
