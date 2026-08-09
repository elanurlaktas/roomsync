import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

import { registry } from './registry.js';
// Yan etki: bu import, tüm endpoint'leri registry'ye kaydeder (bkz. paths.ts).
import './paths.js';

// Dönüş tipi bilinçli olarak açıkça yazılmıyor: openapi3-ts, zod-to-openapi'nin
// dolaylı (transitive) bağımlılığı — doğrudan import etmek yerine üretici
// sınıfın kendi dönüş tipinin çıkarılmasına (inference) izin veriyoruz.
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'RoomSync API',
      version: '1.0.0',
      description:
        'RoomSync — paylaşımlı toplantı odası rezervasyon sistemi (portföy/demo projesi). ' +
        "Tüm zamanlar UTC (timestamptz) saklanır; availability endpoint'i Europe/Istanbul " +
        'yorumu kullanır (bkz. PROJECT_SPEC.md Bölüm 20). Hata gövdeleri her yerde ' +
        '`{ error: { code, message, details? } }` formatındadır.',
    },
    servers: [{ description: 'Bu sunucu', url: '/' }],
    tags: [
      { name: 'Health', description: "Docker healthcheck ve canlı doğrulama için, auth gerekmez" },
      { name: 'Auth', description: 'Kayıt, giriş, token yenileme ve çıkış' },
      { name: 'Rooms', description: 'Oda listeleme/yönetimi ve müsaitlik sorgusu' },
      { name: 'Bookings', description: 'Rezervasyon oluşturma, listeleme ve iptal' },
    ],
  });
}
