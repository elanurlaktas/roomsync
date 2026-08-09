'use client';

import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import * as api from '@/lib/api-client';
import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Room } from '@/lib/types';

type RoomFormState = { name: string; capacity: string; location: string };
const EMPTY_FORM: RoomFormState = { name: '', capacity: '', location: '' };

export default function AdminRoomsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RoomFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.replace('/rooms');
    }
  }, [user, router]);

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

  function openCreateForm() {
    setEditingRoom(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditForm(room: Room) {
    setEditingRoom(room);
    setForm({ name: room.name, capacity: String(room.capacity), location: room.location });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const capacity = Number(form.capacity);
    if (!form.name.trim() || !form.location.trim() || !Number.isInteger(capacity) || capacity <= 0) {
      setFormError('Lütfen tüm alanları geçerli değerlerle doldurun (kapasite pozitif bir tam sayı olmalı)');
      return;
    }

    setSaving(true);
    try {
      const input = { name: form.name.trim(), capacity, location: form.location.trim() };
      if (editingRoom) {
        const updated = await api.updateRoom(editingRoom.id, input);
        setRooms((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
      } else {
        const created = await api.createRoom(input);
        setRooms((prev) => (prev ? [...prev, created] : [created]));
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Oda kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteRoom(deleteTarget.id);
      setRooms((prev) => (prev ? prev.filter((r) => r.id !== deleteTarget.id) : prev));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : 'Oda pasifleştirilemedi');
    } finally {
      setDeleting(false);
    }
  }

  if (user && user.role !== 'admin') {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Oda Yönetimi</h1>
          <p className="text-sm text-muted-foreground">Odaları oluşturun, düzenleyin veya pasifleştirin.</p>
        </div>
        <Button type="button" onClick={openCreateForm} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Yeni Oda
        </Button>
      </div>

      {loading && <LoadingState label="Odalar yükleniyor..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && rooms && rooms.length === 0 && <EmptyState message="Henüz oda eklenmemiş." />}

      {!loading && !error && rooms && rooms.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Kapasite</TableHead>
                <TableHead>Konum</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>{room.capacity} kişi</TableCell>
                  <TableCell>{room.location}</TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => openEditForm(room)}>
                      <Pencil className="h-4 w-4" />
                      Düzenle
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(room);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Pasifleştir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingRoom ? 'Odayı Düzenle' : 'Yeni Oda'}</DialogTitle>
              <DialogDescription>Oda bilgilerini girin.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="roomName">Ad</Label>
                <Input
                  id="roomName"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="örn. Toplantı Odası A"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="roomCapacity">Kapasite</Label>
                <Input
                  id="roomCapacity"
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="örn. 8"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="roomLocation">Konum</Label>
                <Input
                  id="roomLocation"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="örn. 3. Kat"
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Vazgeç
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Odayı pasifleştir</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; odasını pasifleştirmek istediğinize emin misiniz? Pasif odalar yeni
              rezervasyona kapatılır.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Vazgeç
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deleting} className="gap-2">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Evet, pasifleştir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
