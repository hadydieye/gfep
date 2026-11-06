'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { navItemsFor } from './nav-items';

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Entrées de navigation filtrées par permission (AppFlow §4), partagées par la
 * sidebar et le tiroir mobile. En mode icônes (`collapsed`), chaque entrée
 * garde un nom accessible et une infobulle ; un groupe (Finance, Accès) mène à
 * son premier sous-lien accessible.
 */
export function NavMenu({
  user,
  collapsed = false,
  onNavigate,
  label = 'Navigation principale',
}: {
  user: AuthUser;
  collapsed?: boolean;
  onNavigate?: () => void;
  label?: string;
}) {
  const pathname = usePathname();
  const items = navItemsFor(user.permissions);

  const linkClass = (active: boolean) =>
    cn(
      'flex items-center rounded-md py-2 text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link',
      collapsed ? 'justify-center px-2' : 'gap-3 px-3',
      active
        ? 'bg-primary/10 text-link'
        : 'text-foreground-secondary hover:bg-background-main hover:text-foreground-primary',
    );

  return (
    <nav aria-label={label} className={cn('flex flex-1 flex-col gap-1', collapsed ? 'p-2' : 'p-3')}>
      {items.map(({ href, label: itemLabel, icon: Icon, children }) => {
        if (children && !collapsed) {
          return (
            <div key={itemLabel} className="flex flex-col gap-1">
              <span className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground-secondary">
                <Icon className="h-5 w-5" aria-hidden />
                {itemLabel}
              </span>
              {children.map((child) => {
                const active = isActive(pathname, child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(linkClass(active), 'ml-8')}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          );
        }
        const active = children
          ? children.some((child) => isActive(pathname, child.href))
          : isActive(pathname, href);
        return (
          <Link
            key={itemLabel}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            aria-label={collapsed ? itemLabel : undefined}
            title={collapsed ? itemLabel : undefined}
            className={linkClass(active)}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {!collapsed && itemLabel}
          </Link>
        );
      })}
    </nav>
  );
}
