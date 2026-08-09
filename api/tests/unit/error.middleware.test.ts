import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler, notFoundHandler } from '../../src/middleware/error.middleware.js';
import { ApiError } from '../../src/utils/ApiError.js';

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe('notFoundHandler', () => {
  it('404 + NOT_FOUND formatında yanıt döner', () => {
    const req = { method: 'GET', originalUrl: '/does-not-exist' } as Request;
    const res = mockRes();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'GET /does-not-exist bulunamadı' },
    });
  });
});

describe('errorHandler', () => {
  const req = {} as Request;
  const next = vi.fn() as unknown as NextFunction;

  it('ApiError için { error: { code, message } } döner (details yoksa details alanı olmaz)', () => {
    const res = mockRes();
    const error = new ApiError(404, 'ROOM_NOT_FOUND', 'Oda bulunamadı');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'ROOM_NOT_FOUND', message: 'Oda bulunamadı' },
    });
  });

  it('ApiError details taşıyorsa yanıta details alanını ekler (Bölüm 20)', () => {
    const res = mockRes();
    const details = { email: ['Geçerli bir e-posta adresi girin'] };
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Geçersiz istek verisi', details);

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Geçersiz istek verisi', details },
    });
  });

  it('bozuk JSON (body-parser SyntaxError, status: 400) için 400 VALIDATION_ERROR döner', () => {
    const res = mockRes();
    const malformedJsonError = Object.assign(new SyntaxError('Unexpected token'), { status: 400 });

    errorHandler(malformedJsonError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Geçersiz JSON gövdesi' },
    });
  });

  it('beklenmeyen (ApiError olmayan) hatalar için 500 INTERNAL_ERROR döner', () => {
    const res = mockRes();

    errorHandler(new Error('boom'), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Beklenmeyen bir sunucu hatası oluştu' },
    });
  });
});
