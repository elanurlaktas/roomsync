import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['member', 'admin']);
export const bookingStatusEnum = pgEnum('booking_status', ['confirmed', 'cancelled']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('member'),
  // Faz 1 — aktif (rotasyonlu) refresh token'ın hash'i. Login/refresh'te set edilir,
  // logout'ta null'lanır. Bölüm 5'te ayrı bir tablo olarak listelenmemişti; tek
  // aktif oturum yeterli olduğu için (spec'te çoklu cihaz/oturum gereksinimi yok)
  // ayrı bir refresh_tokens tablosu açmak yerine users'a tek kolon eklemek en
  // düşük karmaşıklıklı çözüm oldu.
  refreshTokenHash: text('refresh_token_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  location: text('location').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    title: text('title').notNull(),
    // Opsiyonel — hangi ekip/departmanın rezervasyon yaptığını göstermek için,
    // title'la aynı basitlikte (ayrı bir departments tablosu bu ölçekte gereksiz).
    department: text('department'),
    // ⚠️ withTimezone: true zorunlu (Bölüm 5) — aksi halde Drizzle "timestamp
    // without time zone" üretir ve Faz 3'teki tstzrange() tabanlı exclusion
    // constraint bununla çalışmaz.
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('bookings_ends_after_starts', sql`${table.endsAt} > ${table.startsAt}`)],
);
