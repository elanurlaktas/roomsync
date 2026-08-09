import type { Request, Response } from 'express';

import * as roomsService from './rooms.service.js';
import type { AvailabilityQuery, CreateRoomInput, RoomIdParam, UpdateRoomInput } from './rooms.schema.js';

export async function handleListRooms(_req: Request, res: Response): Promise<void> {
  const rooms = await roomsService.listActiveRooms();
  res.status(200).json({ rooms });
}

export async function handleGetRoom(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RoomIdParam;
  const room = await roomsService.getRoomById(id);
  res.status(200).json({ room });
}

export async function handleGetRoomAvailability(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RoomIdParam;
  const { date } = req.query as unknown as AvailabilityQuery;
  const freeSlots = await roomsService.getRoomAvailability(id, date);
  res.status(200).json({ roomId: id, date, freeSlots });
}

export async function handleCreateRoom(req: Request, res: Response): Promise<void> {
  const room = await roomsService.createRoom(req.body as CreateRoomInput);
  res.status(201).json({ room });
}

export async function handleUpdateRoom(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RoomIdParam;
  const room = await roomsService.updateRoom(id, req.body as UpdateRoomInput);
  res.status(200).json({ room });
}

export async function handleDeleteRoom(req: Request, res: Response): Promise<void> {
  const { id } = req.params as unknown as RoomIdParam;
  await roomsService.deactivateRoom(id);
  res.status(204).send();
}
