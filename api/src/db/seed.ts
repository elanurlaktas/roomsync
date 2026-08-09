import { logger } from '../utils/logger.js';

// Gerçek seed mantığı (admin kullanıcı + örnek odalar/rezervasyonlar) Faz 1'de
// şema oluşturulduktan sonra eklenecek (bkz. PROJECT_SPEC.md Bölüm 5).
async function seed(): Promise<void> {
  logger.info('Seed script henüz uygulanmadı — bkz. Faz 1.');
}

seed()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    logger.error(error, 'Seed işlemi başarısız oldu');
    process.exit(1);
  });
