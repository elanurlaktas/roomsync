'use client';

import { Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import * as api from '@/lib/api-client';
import { ApiClientError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import type { Booking, Room } from '@/lib/types';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [rooms, setRooms] = useState<Record<string, Room>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, roomList] = await Promise.all([api.listBookings({ limit: 20 }), api.getRooms()]);
      setBookings(page.bookings);
      setNextCursor(page.nextCursor);
      setRooms(Object.fromEntries(roomList.map((room) => [room.id, room])));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Rezervasyonlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.listBookings({ cursor: nextCursor, limit: 20 });
      setBookings((prev) => [...(prev ?? []), ...page.bookings]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Rezervasyonlar yüklenemedi');
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await api.cancelBooking(cancelTarget.id);
      setBookings((prev) => (prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev));
      setCancelTarget(null);
    } catch (err) {
      setCancelError(err instanceof ApiClientError ? err.message : 'Rezervasyon iptal edilemedi');
    } finally {
      setCancelling(false);
    }
  }

  const sortedBookings = useMemo(() => bookings ?? [], [bookings]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rezervasyonlarım</h1>
        <p className="text-sm text-muted-foreground">Yaptığınız rezervasyonları görüntüleyin ve iptal edin.</p>
      </div>

      {loading && <LoadingState label="Rezervasyonlar yükleniyor..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && sortedBookings.length === 0 && (
        <EmptyState message="Henüz rezervasyonunuz yok." />
      )}

      {!loading && !error && sortedBookings.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlık</TableHead>
                <TableHead>Departman</TableHead>
                <TableHead>Oda</TableHead>
                <TableHead>Başlangıç</TableHead>
                <TableHead>Bitiş</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBookings.map((booking) => {
                const room = rooms[booking.roomId];
                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.title}</TableCell>
                    <TableCell>
                      {booking.department ? (
                        <Badge variant="outline" className="font-normal">
                          {booking.department}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{room ? room.name : 'Bilinmeyen oda'}</TableCell>
                    <TableCell>{formatDateTime(booking.startsAt)}</TableCell>
                    <TableCell>{formatDateTime(booking.endsAt)}</TableCell>
                    <TableCell>
                      <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                        {booking.status === 'confirmed' ? 'Onaylı' : 'İptal Edildi'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {booking.status === 'confirmed' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => {
                            setCancelError(null);
                            setCancelTarget(booking);
                          }}
                        >
                          <X className="h-4 w-4" />
                          İptal Et
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && nextCursor && (
        <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore} className="w-fit gap-2">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
          Daha fazla yükle
        </Button>
      )}

      <Dialog open={cancelTarget !== null} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rezervasyonu iptal et</DialogTitle>
            <DialogDescription>
              &quot;{cancelTarget?.title}&quot; başlıklı rezervasyonu iptal etmek istediğinize emin misiniz? Bu işlem geri
              alınamaz.
            </DialogDescription>
          </DialogHeader>
          {cancelError && <p className="text-sm text-destructive">{cancelError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Vazgeç
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={confirmCancel} disabled={cancelling} className="gap-2">
              {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              Evet, iptal et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
