import type { NextFunction, Request, Response } from 'express';
import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';

import { ApiError } from '../utils/ApiError.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// express-rate-limit varsayılan olarak kendi JSON gövdesini yazar; bunun yerine
// merkezi error middleware'in ürettiği { error: { code, message } } formatına
// (Bölüm 20) uyması için hatayı next() ile errorHandler'a devrediyoruz.
function rateLimitHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(429, 'RATE_LIMITED', 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'));
}

// Genel limit: tüm endpoint'ler için kaba kuvvet/DoS'a karşı temel bir üst sınır.
// /health bu limitten muaftır çünkü app.ts'te router'lardan önce, bu middleware'den
// önce tanımlanır (Docker healthcheck'in rate limit'e takılmaması için).
export function createGeneralRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

// Login için ayrı, daha sıkı limit (Bölüm 17, Faz 4) — parola kaba kuvvet
// denemelerine karşı ek bir koruma katmanı.
export function createLoginRateLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}
