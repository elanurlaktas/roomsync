import { afterAll, beforeEach } from 'vitest';

import { db, pool } from '../src/db/index.js';
import { bookings, rooms, users } from '../src/db/schema.js';

// Section 12: her testten önce test veritabanı temizlenir. Bağımlılık sırası
// önemli (bookings → users/rooms önce silinmeli, FK ihlali olmasın).
beforeEach(async () => {
  await db.delete(bookings);
  await db.delete(rooms);
  await db.delete(users);
});

afterAll(async () => {
  await pool.end();
});
