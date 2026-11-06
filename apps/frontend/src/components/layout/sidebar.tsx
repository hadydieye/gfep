'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { AuthUser } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { NavMenu } from './nav-menu';

/**
 * Sidebar fixe à partir de 768 px (04 §3, §6, N7) : 260 px, ou 64 px en mode
 * icônes. Sous 768 px, la navigation passe par le tiroir de la topbar.
 */
export function Sidebar({
  user,
  collapsed = false,
  onToggle,
}: {
  user: AuthUser;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-background-surface transition-[width] md:flex',
        collapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-6')}>
        <Link
          href="/dashboard"
          aria-label={collapsed ? 'GUINEA FINANCE — Tableau de bord' : undefined}
          className="text-base font-semibold tracking-wide text-link"
        >
          {collapsed ? 'GF' : 'GUINEA FINANCE'}
        </Link>
      </div>
      <NavMenu user={user} collapsed={collapsed} />
      {onToggle && (
        <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-3')}>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Déplier la barre latérale' : 'Réduire la barre latérale'}
            className={cn(
              'flex w-full items-center rounded-md py-2 text-sm font-medium text-foreground-secondary transition-colors',
              'hover:bg-background-main hover:text-foreground-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5" aria-hidden />
                Réduire
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
