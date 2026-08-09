-- Custom SQL migration file, put your code below! --
-- PROJECT_SPEC.md Bölüm 6: aynı odada çakışan (iptal edilmemiş) rezervasyonları
-- veritabanı seviyesinde imkansız kılan exclusion constraint. Drizzle'ın bunun
-- için native TypeScript API'si olmadığından elle yazılmıştır.
-- ⚠️ Bu dosya bir kez uygulandıktan sonra bir daha `drizzle-kit generate` ile
-- yeniden üretilmemeli/üzerine yazılmamalı (Bölüm 20).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status <> 'cancelled');
