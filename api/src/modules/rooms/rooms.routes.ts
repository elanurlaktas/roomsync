import { Router } from 'express';

import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as roomsController from './rooms.controller.js';
import { availabilityQuerySchema, createRoomSchema, roomIdParamSchema, updateRoomSchema } from './rooms.schema.js';

export const roomsRouter = Router();

roomsRouter.get('/', authenticate, asyncHandler(roomsController.handleListRooms));

roomsRouter.get(
  '/:id',
  authenticate,
  validate(roomIdParamSchema, 'params'),
  asyncHandler(roomsController.handleGetRoom),
);

roomsRouter.get(
  '/:id/availability',
  authenticate,
  validate(roomIdParamSchema, 'params'),
  validate(availabilityQuerySchema, 'query'),
  asyncHandler(roomsController.handleGetRoomAvailability),
);

roomsRouter.post(
  '/',
  authenticate,
  requireRole('admin'),
  validate(createRoomSchema),
  asyncHandler(roomsController.handleCreateRoom),
);

roomsRouter.patch(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(roomIdParamSchema, 'params'),
  validate(updateRoomSchema),
  asyncHandler(roomsController.handleUpdateRoom),
);

roomsRouter.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  validate(roomIdParamSchema, 'params'),
  asyncHandler(roomsController.handleDeleteRoom),
);
