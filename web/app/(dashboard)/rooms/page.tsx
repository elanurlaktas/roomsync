'use client';

import { CalendarPlus, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import * as api from '@/lib/api-client';
import { ApiClientError } from '@/lib/api-client';
import type { Room } from '@/lib/types';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRooms(await api.getRooms());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Odalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Odalar</h1>
        <p className="text-sm text-muted-foreground">Şirketin paylaşımlı toplantı odaları.</p>
      </div>

      {loading && <LoadingState label="Odalar yükleniyor..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && rooms && rooms.length === 0 && (
        <EmptyState message="Henüz aktif bir oda tanımlanmamış." />
      )}
      {!loading && !error && rooms && rooms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id}>
              <CardHeader>
                <CardTitle>{room.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> {room.capacity} kişi
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {room.location}
                </span>
              </CardContent>
              <CardFooter>
                <Button asChild size="sm" className="w-full gap-2">
                  <Link href={`/bookings/new?roomId=${room.id}`}>
                    <CalendarPlus className="h-4 w-4" />
                    Rezervasyon Oluştur
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
