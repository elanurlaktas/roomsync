import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Panel için kapsamlı test şart değil (Bölüm 12) — küçük bir smoke test
// (sayfa render oluyor mu) yeterli. Ağırlıklı test kapsamı zaten api/'da.
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    // Windows'ta fork pool worker'ları zaman zaman zaman aşımına uğruyor;
    // thread pool bu ortamda daha güvenilir.
    pool: 'threads',
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
  },
});
