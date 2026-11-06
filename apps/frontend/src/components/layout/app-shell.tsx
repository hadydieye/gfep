'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sheet } from '@/components/ui/sheet';
import type { AuthUser } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { NavMenu } from './nav-menu';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export const SIDEBAR_STORAGE_KEY = 'gfep-sidebar';
const DESKTOP_MIN_WIDTH = 1280;

function readPreference(): 'collapsed' | 'expanded' | null {
  try {
    const value = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return value === 'collapsed' || value === 'expanded' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Cadre des écrans authentifiés (04 §3, §6, N7) :
 * - mobile (< 768 px) : tiroir de navigation ouvert depuis la topbar ;
 * - tablette (768–1279 px) : sidebar en icônes par défaut ;
 * - desktop (≥ 1280 px) : sidebar 260 px, réductible à la demande.
 * La préférence explicite de l'utilisateur est conservée dans localStorage.
 */
export function AppShell({
  user,
  initialUnreadCount,
  children,
}: {
  user: AuthUser;
  initialUnreadCount: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const preference = readPreference();
    setCollapsed(preference ? preference === 'collapsed' : window.innerWidth < DESKTOP_MIN_WIDTH);
  }, []);

  // Le tiroir se ferme à chaque navigation
  useEffect(() => setDrawerOpen(false), [pathname]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((value) => {
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, value ? 'expanded' : 'collapsed');
      } catch {
        // Stockage indisponible : la préférence vaut pour la session seulement
      }
      return !value;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background-main">
      <Sidebar user={user} collapsed={collapsed} onToggle={toggleSidebar} />
      <Sheet open={drawerOpen} title="Menu de navigation" onOpenChange={setDrawerOpen}>
        <NavMenu user={user} label="Navigation mobile" onNavigate={() => setDrawerOpen(false)} />
      </Sheet>
      <div className={cn('transition-[padding]', collapsed ? 'md:pl-16' : 'md:pl-[260px]')}>
        <Topbar user={user} initialUnreadCount={initialUnreadCount} onOpenMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
