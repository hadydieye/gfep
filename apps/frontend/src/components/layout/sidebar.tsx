'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { navItemsFor } from './nav-items';

export function Sidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const items = navItemsFor(user.permissions);

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[260px] flex-col border-r border-border bg-background-surface md:flex">
      <div className="flex h-14 items-center border-b border-border px-6">
        <Link href="/dashboard" className="text-base font-semibold tracking-wide text-link">
          GUINEA FINANCE
        </Link>
      </div>
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1 p-3">
        {items.map(({ href, label, icon: Icon, children }) => {
          if (children) {
            return (
              <div key={label} className="flex flex-col gap-1">
                <span className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-foreground-secondary">
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </span>
                {children.map((child) => {
                  const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'ml-7 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-link'
                          : 'text-foreground-secondary hover:bg-background-main hover:text-foreground-primary',
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            );
          }
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-link'
                  : 'text-foreground-secondary hover:bg-background-main hover:text-foreground-primary',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
