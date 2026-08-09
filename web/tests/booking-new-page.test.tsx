import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Verilen tarih için Europe/Istanbul takvim gününün tamamını kapsayan tek bir
// boş aralık üretir — bileşenin varsayılan olarak "bugünü" seçmesiyle uyumlu
// kalması için tarih parametresine göre dinamik hesaplanır.
function istanbulFullDayFreeSlot(date: string) {
  return {
    start: new Date(`${date}T00:00:00+03:00`).toISOString(),
    end: new Date(`${date}T23:59:59.999+03:00`).toISOString(),
  };
}

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    getRooms: vi.fn().mockResolvedValue([
      { id: 'room-1', name: 'Toplantı Odası A', capacity: 8, location: '3. Kat', isActive: true, createdAt: '' },
    ]),
    getRoomAvailability: vi.fn().mockImplementation((_id: string, date: string) =>
      Promise.resolve([istanbulFullDayFreeSlot(date)]),
    ),
    createBooking: vi.fn(),
  };
});

import NewBookingPage from '@/app/(dashboard)/bookings/new/page';

describe('NewBookingPage', () => {
  it('departman alanını ve başlangıç/bitiş saati seçicilerini gösterir', async () => {
    render(<NewBookingPage />);

    await waitFor(() => expect(screen.getByText('Yeni Rezervasyon')).toBeInTheDocument());
    expect(screen.getByLabelText(/Departman/)).toBeInTheDocument();

    const startSelect = await screen.findByLabelText('Başlangıç saati');
    const endSelect = screen.getByLabelText('Bitiş saati');
    expect(startSelect).toBeInTheDocument();
    expect(endSelect).toBeInTheDocument();
    // Başlangıç seçilmeden bitiş seçici devre dışı olmalı.
    expect(endSelect).toBeDisabled();

    const user = userEvent.setup();

    await user.click(startSelect);
    const startListbox = await screen.findByRole('listbox');
    const startOptions = within(startListbox).getAllByRole('option');
    expect(startOptions.length).toBeGreaterThan(0);
    await user.click(startOptions[0]!);

    await waitFor(() => expect(endSelect).not.toBeDisabled());

    await user.click(endSelect);
    const endListbox = await screen.findByRole('listbox');
    const endOptions = within(endListbox).getAllByRole('option');
    expect(endOptions.length).toBeGreaterThan(0);
    await user.click(endOptions[0]!);

    expect(screen.getByRole('button', { name: 'Rezervasyonu Oluştur' })).not.toBeDisabled();
  });
});
