'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { LoadingState } from '@/components/state-views';
import { useAuth } from '@/lib/auth-context';

export default function RootPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/rooms');
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingState label="RoomSync yükleniyor..." />
    </div>
  );
}
