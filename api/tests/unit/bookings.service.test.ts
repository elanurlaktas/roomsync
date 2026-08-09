import { describe, expect, it } from 'vitest';

import { doTimeRangesOverlap } from '../../src/modules/bookings/bookings.service.js';

const d = (iso: string): Date => new Date(iso);

describe('doTimeRangesOverlap', () => {
  it('kısmi çakışan iki aralık için true döner', () => {
    const result = doTimeRangesOverlap(
      d('2026-08-10T10:00:00Z'),
      d('2026-08-10T11:00:00Z'),
      d('2026-08-10T10:30:00Z'),
      d('2026-08-10T11:30:00Z'),
    );
    expect(result).toBe(true);
  });

  it('biri diğerini tamamen kapsıyorsa true döner', () => {
    const result = doTimeRangesOverlap(
      d('2026-08-10T09:00:00Z'),
      d('2026-08-10T12:00:00Z'),
      d('2026-08-10T10:00:00Z'),
      d('2026-08-10T11:00:00Z'),
    );
    expect(result).toBe(true);
  });

  it('birebir aynı aralıklar için true döner', () => {
    const result = doTimeRangesOverlap(
      d('2026-08-10T10:00:00Z'),
      d('2026-08-10T11:00:00Z'),
      d('2026-08-10T10:00:00Z'),
      d('2026-08-10T11:00:00Z'),
    );
    expect(result).toBe(true);
  });

  it('ayrık (çakışmayan) aralıklar için false döner', () => {
    const result = doTimeRangesOverlap(
      d('2026-08-10T09:00:00Z'),
      d('2026-08-10T10:00:00Z'),
      d('2026-08-10T11:00:00Z'),
      d('2026-08-10T12:00:00Z'),
    );
    expect(result).toBe(false);
  });

  it('sınırları birbirine değen (bitiş = başlangıç) aralıklar için false döner', () => {
    const result = doTimeRangesOverlap(
      d('2026-08-10T09:00:00Z'),
      d('2026-08-10T10:00:00Z'),
      d('2026-08-10T10:00:00Z'),
      d('2026-08-10T11:00:00Z'),
    );
    expect(result).toBe(false);
  });
});
