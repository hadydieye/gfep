'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
}

/**
 * Onglets accessibles (design §10) : rôles ARIA tablist/tab/tabpanel, navigation
 * au clavier par flèches gauche/droite, Début et Fin ; tokens GFEP.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  label,
  children,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  const baseId = React.useId();
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, items.findIndex((item) => item.value === value));

  const focus = (next: number) => {
    const target = (next + items.length) % items.length;
    onValueChange(items[target].value);
    refs.current[target]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') focus(index + 1);
    else if (event.key === 'ArrowLeft') focus(index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(items.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-border" onKeyDown={onKeyDown}>
        {items.map((item, i) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(element) => {
                refs.current[i] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onValueChange(item.value)}
              className={cn(
                'relative px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link',
                selected ? 'text-link' : 'text-foreground-secondary hover:text-foreground-primary',
              )}
            >
              {item.label}
              {/* Indicateur de l'onglet actif */}
              {selected && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-link" />}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${value}`}>
        {children}
      </div>
    </div>
  );
}
