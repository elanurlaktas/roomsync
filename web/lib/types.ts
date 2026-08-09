export type Role = 'member' | 'admin';

export type User = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type Room = {
  id: string;
  name: string;
  capacity: number;
  location: string;
  isActive: boolean;
  createdAt: string;
};

export type BookingStatus = 'confirmed' | 'cancelled';

export type Booking = {
  id: string;
  userId: string;
  roomId: string;
  title: string;
  department: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  createdAt: string;
};

export type FreeSlot = { start: string; end: string };

export type BookingsPage = {
  bookings: Booking[];
  nextCursor: string | null;
};

export type CreateRoomInput = {
  name: string;
  capacity: number;
  location: string;
};

export type UpdateRoomInput = Partial<CreateRoomInput> & { isActive?: boolean };

export type CreateBookingInput = {
  roomId: string;
  title: string;
  department?: string;
  startsAt: string;
  endsAt: string;
};
