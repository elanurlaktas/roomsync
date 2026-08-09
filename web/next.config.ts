import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geliştirme makinesinde bu repo dışında da bir package-lock.json bulunabiliyor;
  // Turbopack'in workspace kökünü doğru (bu repo) algılamasını garantiler.
  turbopack: {
    root: path.join(__dirname),
  },
  // Aynı sebep: `next build`'in dosya izleme (output file tracing) köküne de
  // aynı şekilde rehberlik eder — Docker image'ı minimal tutmak için kullanılan
  // `output: 'standalone'` bu kökten doğru şekilde faydalanır (bkz. web/Dockerfile).
  outputFileTracingRoot: path.join(__dirname),
  // Docker için (Bölüm 14) — sadece gerekli node_modules alt kümesini içeren
  // bağımsız bir üretim sunucusu (`.next/standalone`) üretir; tüm node_modules'ü
  // image'a kopyalamaktan çok daha küçük bir production image sağlar.
  output: 'standalone',
  // `next dev`'in repo köküne otomatik ek dokümantasyon dosyaları üretmesini
  // kapatır; bu proje ölçeğinde gereksiz ve repo'yu kirletiyor.
  agentRules: false,
};

export default nextConfig;
