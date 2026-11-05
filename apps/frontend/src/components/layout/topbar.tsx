'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Loader2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client';
import type { AuthUser } from '@/lib/api/types';
import { navItemsFor } from './nav-items';

export function Topbar({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const displayName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user.username;
  // Notifications : module MVP 2, aucun élément non lu pour l'instant
  const unreadCount = 0;

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
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} non lues)`}
          className="relative rounded-md p-2 text-foreground-secondary hover:bg-background-main"
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-background-main-dark">
              {unreadCount}
            </span>
          )}
        </button>
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
