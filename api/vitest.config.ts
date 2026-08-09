import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Entegrasyon testleri tek, paylaşılan bir test veritabanını kullanıyor ve
    // `tests/setup.ts` her testten önce ortak tabloları temizliyor. Test
    // dosyaları paralel çalışırsa (Vitest varsayılanı) bir dosyanın temizliği,
    // başka bir dosyanın o an ürettiği fixture'ları silebilir (flaky 404'ler).
    // Dosyaları sıralı çalıştırmak bunu ortadan kaldırır; testler içindeki asıl
    // eşzamanlılık testi (Promise.all) bundan etkilenmez.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // `exclude` varsayılanların YERİNE geçer (üzerine eklemez) — bu yüzden
      // vitest'in kendi varsayılan listesi (coverageConfigDefaults.exclude:
      // test dosyaları, config dosyaları, node_modules vb.) burada elle
      // korunuyor. server.ts (app.listen ile ince bir giriş noktası) ve
      // drizzle.config.ts iş mantığı içermez; seed.ts ise Bölüm 5'teki gerçek
      // seed mantığı henüz uygulanmadığı için bir placeholder'dır (bu fazın
      // kapsamı dışında) — üçü de anlamsız 0% satırları olarak rapora/eşiğe
      // gürültü katmasın diye ek olarak hariç tutulur.
      exclude: [...coverageConfigDefaults.exclude, 'drizzle.config.ts', 'src/server.ts', 'src/db/seed.ts'],
      // Bölüm 12 — hedef %70+. Bu eşiklerin altına düşülürse `test:coverage`
      // (ve CI) başarısız olur.
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
