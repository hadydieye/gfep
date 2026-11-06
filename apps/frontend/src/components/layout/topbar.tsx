'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client';
import type { AuthUser } from '@/lib/api/types';
import { NOTIFICATIONS_CHANGED_EVENT } from '@/components/notifications/notification-meta';
import { navItemsFor } from './nav-items';

export function Topbar({ user, initialUnreadCount = 0 }: { user: AuthUser; initialUnreadCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const displayName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user.username;

  // Compteur réel (M19) : rechargé à chaque navigation et après chaque action sur les notifications
  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await apiFetch<{ count: number }>('/notifications/unread-count');
      if (active && result.ok) setUnreadCount(result.data.count);
    };
    void load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, load);
    };
  }, [pathname]);

  const logout = async () => {
    setLoggingOut(true);
    await apiFetch('/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background-surface px-4 md:px-6">
      {/* Navigation compacte sur mobile (la sidebar est masquée) */}
      <nav aria-label="Navigation mobile" className="flex gap-1 md:hidden">
        {navItemsFor(user.permissions).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className="rounded-md p-2 text-foreground-secondary hover:bg-background-main"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/notifications"
          aria-label={`Notifications (${unreadCount} non lue${unreadCount > 1 ? 's' : ''})`}
          aria-current={pathname === '/notifications' ? 'page' : undefined}
          className="relative rounded-md p-2 text-foreground-secondary hover:bg-background-main"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 && (
            <span
              data-testid="unread-badge"
              className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-background-main-dark"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <span className="hidden text-sm font-medium text-foreground-primary sm:inline">
          {displayName}
        </span>
        <Button variant="secondary" size="sm" onClick={logout} disabled={loggingOut}>
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden />
          )}
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
