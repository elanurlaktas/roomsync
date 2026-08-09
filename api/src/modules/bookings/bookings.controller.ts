import type { Request, Response } from 'express';

import { ApiError } from '../../utils/ApiError.js';
import * as bookingsService from './bookings.service.js';
import type { BookingIdParam, CreateBookingInput, ListBookingsQuery } from './bookings.schema.js';

export async function handleCreateBooking(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', "Erişim token'ı bulunamadı");
  }
  const booking = await bookingsService.createBooking(req.user.id, req.body as CreateBookingInput);
  res.status(201).json({ booking });
}

export async function handleListBookings(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', "Erişim token'ı bulunamadı");
  }
  const { cursor, limit } = req.query as unknown as ListBookingsQuery;
  const result = await bookingsService.listBookings(req.user.id, req.user.role, { cursor, limit });
  res.status(200).json({ bookings: result.bookings, nextCursor: result.nextCursor });
}

export async function handleGetBooking(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', "Erişim token'ı bulunamadı");
  }
  const { id } = req.params as unknown as BookingIdParam;
  const booking = await bookingsService.getBookingById(req.user.id, req.user.role, id);
  res.status(200).json({ booking });
}

export async function handleCancelBooking(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', "Erişim token'ı bulunamadı");
  }
  const { id } = req.params as unknown as BookingIdParam;
  const booking = await bookingsService.cancelBooking(req.user.id, req.user.role, id);
  res.status(200).json({ booking });
}
