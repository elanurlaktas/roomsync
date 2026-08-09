// Tüm zamanlar backend'de UTC (timestamptz) saklanır; panelde her zaman
// kullanıcının tarayıcı saat dilimine göre gösterilir (Bölüm 8) —
// `Intl.DateTimeFormat` timeZone belirtilmediğinde otomatik olarak bunu yapar.

const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
});

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** `<input type="date">` için bugünün (yerel saat diliminde) YYYY-MM-DD karşılığı. */
export function todayInputValue(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** `<input type="datetime-local">` value'sunu (yerel saat, tz'siz) ISO/UTC string'e çevirir. */
export function localInputToIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

/** ISO/UTC string'i `<input type="datetime-local">` value formatına (yerel saat) çevirir. */
export function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export type HourSlot = { start: string; end: string; free: boolean };

// Backend'in availability hesaplaması Europe/Istanbul takvim gününü (00:00–23:59:59.999)
// baz alıyor (bkz. rooms.service.ts) — burada aynı takvim gününü 1 saatlik
// dilimlere bölüp her birini backend'den gelen boş aralıklarla (freeSlots)
// karşılaştırıyoruz. Bu, availability hesaplama mantığını DEĞİŞTİRMEZ, sadece
// panelde nasıl sunulduğunu değiştirir.
const ISTANBUL_UTC_OFFSET = '+03:00';

export function computeHourlySlots(date: string, freeSlots: FreeSlotLike[]): HourSlot[] {
  const slots: HourSlot[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const start = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00${ISTANBUL_UTC_OFFSET}`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    // Backend gün sonunu 23:59:59.999 olarak kapatıyor (bkz. rooms.service.ts
    // getRoomAvailability) — 23:00-24:00 dilimi bu yüzden 1ms toleransla
    // karşılaştırılmazsa günün son saati yanlışlıkla "dolu" görünür.
    const free = freeSlots.some(
      (slot) => new Date(slot.start).getTime() <= start.getTime() && new Date(slot.end).getTime() >= end.getTime() - 1,
    );
    slots.push({ start: start.toISOString(), end: end.toISOString(), free });
  }
  return slots;
}

type FreeSlotLike = { start: string; end: string };
