import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';

import { env } from '../../src/config/env.js';
import { authenticate, requireRole } from '../../src/middleware/auth.middleware.js';
import { ApiError } from '../../src/utils/ApiError.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as Request;
}

describe('authenticate', () => {
  it('geçerli Bearer token ile req.user set eder ve next() çağırır', () => {
    const token = jwt.sign({ sub: 'user-1', role: 'admin' }, env.JWT_ACCESS_SECRET, {
      expiresIn: '15m',
    });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, {} as Response, next);

    expect(req.user).toEqual({ id: 'user-1', role: 'admin' });
    expect(next).toHaveBeenCalledWith();
  });

  it('Authorization header yoksa 401 ApiError ile next() çağırır', () => {
    const req = mockReq();
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(error.statusCode).toBe(401);
  });

  it('geçersiz token ile 401 ApiError ile next() çağırır', () => {
    const req = mockReq({ headers: { authorization: 'Bearer not-a-real-token' } });
    const next = vi.fn() as unknown as NextFunction;

    authenticate(req, {} as Response, next);

    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(error.statusCode).toBe(401);
  });
});

describe('requireRole', () => {
  it('req.user rolü izin verilenler arasındaysa next() çağırır', () => {
    const req = mockReq({ user: { id: 'user-1', role: 'admin' } });
    const next = vi.fn() as unknown as NextFunction;

    requireRole('admin')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('req.user rolü izin verilenler arasında değilse 403 ApiError döner', () => {
    const req = mockReq({ user: { id: 'user-1', role: 'member' } });
    const next = vi.fn() as unknown as NextFunction;

    requireRole('admin')(req, {} as Response, next);

    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(error.statusCode).toBe(403);
  });

  it('req.user yoksa 401 ApiError döner', () => {
    const req = mockReq();
    const next = vi.fn() as unknown as NextFunction;

    requireRole('admin')(req, {} as Response, next);

    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as ApiError;
    expect(error.statusCode).toBe(401);
  });
});
