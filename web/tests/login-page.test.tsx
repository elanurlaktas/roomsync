import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Auth durumunu ve fetch tabanlı silent-refresh akışını devre dışı bırakıp
// sadece sayfanın kendisinin doğru render olduğunu (Bölüm 12 — panel için
// küçük bir smoke test yeterli) izole şekilde doğruluyoruz.
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ status: 'unauthenticated', user: null, login: vi.fn(), logout: vi.fn() }),
}));

import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('renders without crashing and shows the login form', () => {
    render(<LoginPage />);

    expect(screen.getByText('RoomSync')).toBeInTheDocument();
    expect(screen.getByLabelText('E-posta')).toBeInTheDocument();
    expect(screen.getByLabelText('Şifre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giriş Yap' })).toBeInTheDocument();
  });
});
