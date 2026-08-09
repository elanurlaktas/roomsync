'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import * as api from './api-client';
import type { User } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Bölüm 11 — "silent refresh": access token bellekte tutulduğu için F5'te
// kaybolur. Bu provider mount olduğunda arka planda /auth/refresh çağırarak
// (HttpOnly refresh cookie sayesinde) kullanıcıyı sessizce oturumda tutar.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    // api-client, tek uçuşlu refresh sonucu kesin olarak başarısız olduğunda
    // (kullanıcının oturumu gerçekten bitmiş) bunu çağırır — böylece herhangi
    // bir sayfada arka planda tetiklenen bir 401, kullanıcıyı login'e düşürür.
    api.setUnauthorizedHandler(() => {
      if (cancelled) return;
      setUser(null);
      setStatus('unauthenticated');
    });

    api.refreshSession().then((sessionUser) => {
      if (cancelled) return;
      setUser(sessionUser);
      setStatus(sessionUser ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      cancelled = true;
      api.setUnauthorizedHandler(null);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedInUser = await api.login(email, password);
    setUser(loggedInUser);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  }
  return ctx;
}
