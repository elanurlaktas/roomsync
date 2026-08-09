import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { logger } from '../utils/logger.js';
import { db, pool } from './index.js';

// Docker/Oracle Cloud dağıtımında migration'ları elle çalıştırmayı unutmamak
// için (Bölüm 15, madde 6) container başlangıcının bir parçası olarak
// çalıştırılan bağımsız bir script — `drizzle-kit` CLI'ı (devDependency)
// production image'ına dahil etmeden, drizzle-orm'un runtime migrator'ını
// kullanır.
const MAX_ATTEMPTS = 10;
const RETRY_DELAY_MS = 2000;

async function migrateWithRetry(attempt = 1): Promise<void> {
  try {
    await migrate(db, { migrationsFolder: './src/db/migrations' });
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      throw error;
    }
    // `docker-compose.yml`'deki healthcheck normalde Postgres hazır olmadan
    // api'nin başlamasını önlüyor, ama ekstra bir güvenlik payı için kısa bir
    // yeniden deneme döngüsü de burada var.
    logger.warn(`Migration denemesi ${attempt} başarısız oldu, ${RETRY_DELAY_MS}ms sonra tekrar denenecek...`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return migrateWithRetry(attempt + 1);
  }
}

async function main(): Promise<void> {
  logger.info('Veritabanı migration\'ları uygulanıyor...');
  await migrateWithRetry();
  logger.info('Migration\'lar başarıyla uygulandı');
  await pool.end();
}

main().catch((error: unknown) => {
  logger.error(error, 'Migration başarısız oldu');
  process.exit(1);
});
