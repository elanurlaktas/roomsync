'use client';

import { Building2, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState, LoadingState } from '@/components/state-views';
import * as api from '@/lib/api-client';
import { ApiClientError } from '@/lib/api-client';
import { computeHourlySlots, formatTime, todayInputValue } from '@/lib/format';
import type { FreeSlot, Room } from '@/lib/types';

export default function NewBookingPage() {
  return (
    <Suspense fallback={<LoadingState label="Form yükleniyor..." />}>
      <NewBookingForm />
    </Suspense>
  );
}

function NewBookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRoomId = searchParams.get('roomId') ?? '';

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const [roomId, setRoomId] = useState(preselectedRoomId);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [date, setDate] = useState(todayInputValue());

  const [freeSlots, setFreeSlots] = useState<FreeSlot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Değerler hep saatlik dilim sınırlarının ISO string'leri (bkz. computeHourlySlots).
  const [startsAt, setStartsAt] = useState<string>('');
  const [endsAt, setEndsAt] = useState<string>('');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadRooms = useCallback(async () => {
    setLoadingRooms(true);
    setLoadError(null);
    try {
      const data = await api.getRooms();
      setRooms(data);
      if (!preselectedRoomId && data.length > 0 && data[0]) {
        setRoomId(data[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : 'Odalar yüklenemedi');
    } finally {
      setLoadingRooms(false);
    }
  }, [preselectedRoomId]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const loadAvailability = useCallback(async () => {
    if (!roomId || !date) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setStartsAt('');
    setEndsAt('');
    try {
      setFreeSlots(await api.getRoomAvailability(roomId, date));
    } catch (err) {
      setSlotsError(err instanceof ApiClientError ? err.message : 'Müsaitlik bilgisi alınamadı');
    } finally {
      setLoadingSlots(false);
    }
  }, [roomId, date]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  const hourlySlots = useMemo(
    () => (freeSlots ? computeHourlySlots(date, freeSlots) : []),
    [date, freeSlots],
  );

  // Başlangıç seçici: o gün içinde boş olan her saatin başlangıç noktası.
  const startOptions = useMemo(() => hourlySlots.filter((slot) => slot.free), [hourlySlots]);

  // Bitiş seçici: seçilen başlangıçtan itibaren, bir sonraki dolu rezervasyona
  // kadar olan ardışık boş saatlerin bitiş noktaları — böylece kullanıcı hiçbir
  // zaman dolu bir saate denk gelen bir aralık seçemez.
  const endOptions = useMemo(() => {
    if (!startsAt) return [];
    const startIdx = hourlySlots.findIndex((slot) => slot.start === startsAt);
    if (startIdx === -1) return [];

    const options: { value: string; label: string }[] = [];
    for (let i = startIdx; i < hourlySlots.length; i += 1) {
      const slot = hourlySlots[i];
      if (!slot || !slot.free) break;
      options.push({ value: slot.end, label: formatTime(slot.end) });
    }
    return options;
  }, [hourlySlots, startsAt]);

  function handleStartChange(value: string) {
    setSubmitError(null);
    setStartsAt(value);
    setEndsAt('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!roomId) {
      setSubmitError('Lütfen bir oda seçin');
      return;
    }
    if (!startsAt || !endsAt) {
      setSubmitError('Lütfen başlangıç ve bitiş saati seçin');
      return;
    }

    setSubmitting(true);
    try {
      await api.createBooking({
        roomId,
        title: title.trim() || 'Rezervasyon',
        department: department.trim() || undefined,
        startsAt,
        endsAt,
      });
      setSuccess(true);
      setTimeout(() => router.push('/bookings'), 900);
    } catch (err) {
      setSubmitError(err instanceof ApiClientError ? err.message : 'Rezervasyon oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rezervasyon Oluştur</h1>
        <p className="text-sm text-muted-foreground">Bir oda ve tarih seçin, ardından uygun başlangıç/bitiş saatini belirleyin.</p>
      </div>

      {loadingRooms && <LoadingState label="Odalar yükleniyor..." />}
      {!loadingRooms && loadError && <ErrorState message={loadError} onRetry={loadRooms} />}

      {!loadingRooms && !loadError && rooms && rooms.length > 0 && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Yeni Rezervasyon</CardTitle>
            <CardDescription>
              Seçtiğiniz oda, aynı saat aralığında başka biri tarafından rezerve edilmişse istek reddedilir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="room">Oda</Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger id="room" className="w-full">
                      <SelectValue placeholder="Bir oda seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name} — {room.capacity} kişi, {room.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="date">Gün</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="title">Başlık</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="örn. Sprint Planlama"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="department" className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Departman
                    <span className="font-normal text-muted-foreground">(opsiyonel)</span>
                  </Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="örn. Mühendislik"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Saat Aralığı</Label>
                {loadingSlots && <p className="text-sm text-muted-foreground">Müsaitlik kontrol ediliyor...</p>}
                {!loadingSlots && slotsError && <p className="text-sm text-destructive">{slotsError}</p>}
                {!loadingSlots && !slotsError && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="startsAt" className="text-xs font-normal text-muted-foreground">
                          Başlangıç saati
                        </Label>
                        <Select value={startsAt} onValueChange={handleStartChange}>
                          <SelectTrigger id="startsAt" className="w-full">
                            <SelectValue placeholder="Saat seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {startOptions.length === 0 && (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">Bu gün için boş saat yok</div>
                            )}
                            {startOptions.map((slot) => (
                              <SelectItem key={slot.start} value={slot.start}>
                                {formatTime(slot.start)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="endsAt" className="text-xs font-normal text-muted-foreground">
                          Bitiş saati
                        </Label>
                        <Select value={endsAt} onValueChange={setEndsAt} disabled={!startsAt}>
                          <SelectTrigger id="endsAt" className="w-full">
                            <SelectValue placeholder={startsAt ? 'Saat seçin' : 'Önce başlangıç seçin'} />
                          </SelectTrigger>
                          <SelectContent>
                            {endOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Her iki liste de yalnızca bu odanın o gün için müsait olduğu saatleri gösterir; dolu saatlere denk
                      gelen bir aralık seçilemez.
                    </p>
                  </>
                )}
              </div>

              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
              {success && (
                <Alert>
                  <AlertDescription>Rezervasyon oluşturuldu, yönlendiriliyorsunuz...</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={submitting || success || !startsAt || !endsAt} className="w-fit gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Rezervasyonu Oluştur
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {!loadingRooms && !loadError && rooms && rooms.length === 0 && (
        <p className="text-sm text-muted-foreground">Rezervasyon oluşturmak için önce bir oda tanımlanmalı.</p>
      )}
    </div>
  );
}
