'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  busy = false,
  onOpenChange,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Contenu complémentaire (ex. option du choix confirmé), placé sous la description */
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open || destructive) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, destructive, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background-main-dark/50 p-4"
      data-testid="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !destructive) onOpenChange(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-[8px] border border-border bg-background-surface p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-foreground-primary">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm text-foreground-secondary">
              {description}
            </p>
          </div>
          {!destructive && (
            <Button
              variant="secondary"
              size="icon"
              aria-label="Fermer la fenêtre"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}