import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import * as bookingsController from '../../src/modules/bookings/bookings.controller.js';
import { ApiError } from '../../src/utils/ApiError.js';

// authenticate middleware'i her zaman req.user set eder (veya zaten 401 döner),
// bu yüzden controller'daki `if (!req.user)` kontrolleri normal akışta hiç
// tetiklenmez — ama "asla olmamalı" varsayımını doğrulayan, ucuz bir savunma
// katmanıdır ve tek başına test edilmeye değer (coverage Bölüm 12).
function reqWithoutUser(): Request {
  return { body: {}, query: {}, params: {} } as Request;
}

describe('bookings.controller — req.user olmadan çağrılan handler\'lar', () => {
  it('handleCreateBooking 401 ApiError fırlatır', async () => {
    await expect(bookingsController.handleCreateBooking(reqWithoutUser(), {} as Response)).rejects.toMatchObject({
      statusCode: 401,
    } satisfies Partial<ApiError>);
  });

  it('handleListBookings 401 ApiError fırlatır', async () => {
    await expect(bookingsController.handleListBookings(reqWithoutUser(), {} as Response)).rejects.toMatchObject({
      statusCode: 401,
    } satisfies Partial<ApiError>);
  });

  it('handleGetBooking 401 ApiError fırlatır', async () => {
    await expect(bookingsController.handleGetBooking(reqWithoutUser(), {} as Response)).rejects.toMatchObject({
      statusCode: 401,
    } satisfies Partial<ApiError>);
  });

  it('handleCancelBooking 401 ApiError fırlatır', async () => {
    await expect(bookingsController.handleCancelBooking(reqWithoutUser(), {} as Response)).rejects.toMatchObject({
      statusCode: 401,
    } satisfies Partial<ApiError>);
  });
});
