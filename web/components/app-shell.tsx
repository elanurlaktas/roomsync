'use client';

import { CalendarPlus, Coffee, ListChecks, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/rooms', label: 'Odalar', icon: Coffee },
  { href: '/bookings/new', label: 'Rezervasyon Oluştur', icon: CalendarPlus },
  { href: '/bookings', label: 'Rezervasyonlarım', icon: ListChecks },
] as const;

const ADMIN_NAV_ITEM = { href: '/admin/rooms', label: 'Oda Yönetimi', icon: Settings } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const navItems = user?.role === 'admin' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-1 border-b bg-sidebar p-3 md:w-56 md:border-b-0 md:border-r md:p-4">
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">RoomSync</span>
        </div>
        <nav className="flex flex-1 flex-row gap-1 md:flex-col">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-background px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            {user && (
              <>
                <span className="text-sm font-medium">{user.email}</span>
                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                  {user.role === 'admin' ? 'Admin' : 'Üye'}
                </Badge>
              </>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </Button>
        </header>
        <Separator />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
