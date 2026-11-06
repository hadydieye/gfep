'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panneau latéral modal (tiroir de navigation mobile, 04 §6, N7) : fermeture
 * par Échap, clic sur le voile ou bouton ; focus piégé tant qu'il est ouvert,
 * puis rendu à l'élément qui l'a ouvert.
 */
export function Sheet({
  open,
  title,
  onOpenChange,
  children,
}: {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-background-main-dark/50"
      data-testid="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-[280px] max-w-[85vw] flex-col border-r border-border bg-background-surface shadow-card"
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="text-base font-semibold tracking-wide text-link">GUINEA FINANCE</span>
          <Button variant="secondary" size="icon" aria-label="Fermer le menu" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
