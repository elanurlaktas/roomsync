// RoomSync API için ince bir fetch sarmalayıcısı.
//
// İki şey burada özellikle önemli (bkz. PROJECT_SPEC.md Bölüm 11):
// 1. Access token bellekte (bu modülün kapsamındaki bir değişkende) tutulur —
//    sayfa yenilenince kaybolur. Bunu telafi etmek AuthProvider'ın işi
//    (bkz. lib/auth-context.tsx): mount olduğunda /auth/refresh çağırır.
// 2. Refresh token rotasyonlu olduğu için, aynı anda birden fazla istek 401
//    alıp hepsi paralel /auth/refresh çağırırsa ilk çağrı token'ı rotasyonlar
//    ve diğerleri artık geçersiz olan eski token'ı kullanmaya çalışır. Bunu
//    önlemek için burada TEK UÇUŞLU (single-flight) bir refresh mekanizması
//    var: aynı anda birden fazla refresh ihtiyacı varsa hepsi aynı promise'i
//    paylaşır, ayrı ayrı /auth/refresh çağırmazlar.

import type {
  Booking,
  BookingsPage,
  CreateBookingInput,
  CreateRoomInput,
  FreeSlot,
  Room,
  UpdateRoomInput,
  User,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** AuthProvider, refresh tamamen başarısız olduğunda (kullanıcı gerçekten çıkış
 *  yapmış/oturumu bitmiş) çağrılacak bir temizlik fonksiyonu kaydeder. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// /auth/refresh'in kendisi 401 dönerse (veya bu fonksiyonlar zaten auth akışının
// bir parçasıysa) tekrar refresh denemesi sonsuz döngüye/anlamsız isteğe yol açar.
const NO_RETRY_PATHS = new Set(['/auth/login', '/auth/refresh', '/auth/logout']);

async function parseErrorBody(res: Response): Promise<ApiClientError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    return new ApiClientError(
      res.status,
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? 'Beklenmeyen bir hata oluştu',
      body.error?.details,
    );
  } catch {
    return new ApiClientError(res.status, 'UNKNOWN_ERROR', `İstek başarısız oldu (${res.status})`);
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const data = (await res.json()) as { accessToken: string };
        accessToken = data.accessToken;
        return accessToken;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !isRetry && !NO_RETRY_PATHS.has(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, true);
    }
    onUnauthorized?.();
  }

  if (!res.ok) {
    throw await parseErrorBody(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// --- Auth -------------------------------------------------------------

export async function login(email: string, password: string): Promise<User> {
  const data = await request<{ user: User; accessToken: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function refreshSession(): Promise<User | null> {
  try {
    const data = await request<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' });
    setAccessToken(data.accessToken);
    return data.user;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
  }
}

// --- Rooms --------------------------------------------------------------

export async function getRooms(): Promise<Room[]> {
  const data = await request<{ rooms: Room[] }>('/rooms');
  return data.rooms;
}

export async function getRoom(id: string): Promise<Room> {
  const data = await request<{ room: Room }>(`/rooms/${id}`);
  return data.room;
}

export async function getRoomAvailability(id: string, date: string): Promise<FreeSlot[]> {
  const data = await request<{ freeSlots: FreeSlot[] }>(`/rooms/${id}/availability`, { query: { date } });
  return data.freeSlots;
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const data = await request<{ room: Room }>('/rooms', { method: 'POST', body: input });
  return data.room;
}

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<Room> {
  const data = await request<{ room: Room }>(`/rooms/${id}`, { method: 'PATCH', body: input });
  return data.room;
}

export async function deleteRoom(id: string): Promise<void> {
  await request<void>(`/rooms/${id}`, { method: 'DELETE' });
}

// --- Bookings -------------------------------------------------------------

export async function listBookings(options: { cursor?: string; limit?: number } = {}): Promise<BookingsPage> {
  return request<BookingsPage>('/bookings', { query: options });
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const data = await request<{ booking: Booking }>('/bookings', { method: 'POST', body: input });
  return data.booking;
}

export async function cancelBooking(id: string): Promise<Booking> {
  const data = await request<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: 'PATCH' });
  return data.booking;
}
