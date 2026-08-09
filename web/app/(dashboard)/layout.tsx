'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { AppShell } from '@/components/app-shell';
import { LoadingState } from '@/components/state-views';
import { useAuth } from '@/lib/auth-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Oturum kontrol ediliyor..." />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
