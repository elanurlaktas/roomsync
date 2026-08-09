import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as bookingsController from './bookings.controller.js';
import { bookingIdParamSchema, createBookingSchema, listBookingsQuerySchema } from './bookings.schema.js';

export const bookingsRouter = Router();

bookingsRouter.get(
  '/',
  authenticate,
  validate(listBookingsQuerySchema, 'query'),
  asyncHandler(bookingsController.handleListBookings),
);

bookingsRouter.post(
  '/',
  authenticate,
  validate(createBookingSchema),
  asyncHandler(bookingsController.handleCreateBooking),
);

bookingsRouter.get(
  '/:id',
  authenticate,
  validate(bookingIdParamSchema, 'params'),
  asyncHandler(bookingsController.handleGetBooking),
);

bookingsRouter.patch(
  '/:id/cancel',
  authenticate,
  validate(bookingIdParamSchema, 'params'),
  asyncHandler(bookingsController.handleCancelBooking),
);
