'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SortOrder } from '@/lib/use-sort';

interface SortableHeadProps {
  label: string;
  sortKey: string;
  sort: string | null;
  order: SortOrder;
  onSort: (key: string) => void;
  className?: string;
}

/**
 * En-tête de colonne triable (04 §4.2, N6) : bouton accessible au clavier,
 * `aria-sort` sur la cellule, icône d'état Lucide.
 */
export function SortableHead({ label, sortKey, sort, order, onSort, className }: SortableHeadProps) {
  const active = sort === sortKey;
  const Icon = !active ? ArrowUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  const next = active && order === 'asc' ? 'décroissant' : 'croissant';
  return (
    <TableHead aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Trier par ${label.toLowerCase()} (ordre ${next})`}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm font-semibold uppercase tracking-wide transition-colors',
          'hover:text-foreground-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link',
          active && 'text-foreground-primary',
        )}
      >
        {label}
        <Icon className={cn('h-4 w-4', !active && 'opacity-60')} aria-hidden />
      </button>
    </TableHead>
  );
}

interface SortSelectProps {
  options: ReadonlyArray<{ key: string; label: string }>;
  sort: string | null;
  order: SortOrder;
  onSelect: (key: string | null, order: SortOrder) => void;
  className?: string;
}

/**
 * Sélecteur de tri des vues en cartes (mobile, `04` §6), où les en-têtes de
 * colonnes ne sont pas affichés.
 */
export function SortSelect({ options, sort, order, onSelect, className }: SortSelectProps) {
  return (
    <Select
      label="Trier par"
      className={className}
      value={sort ? `${sort}:${order}` : ''}
      onChange={(event) => {
        const [key, wanted] = event.target.value.split(':');
        onSelect(key || null, wanted === 'desc' ? 'desc' : 'asc');
      }}
    >
      <option value="">Ordre par défaut</option>
      {options.flatMap(({ key, label }) => [
        <option key={`${key}:asc`} value={`${key}:asc`}>
          {label} (croissant)
        </option>,
        <option key={`${key}:desc`} value={`${key}:desc`}>
          {label} (décroissant)
        </option>,
      ])}
    </Select>
  );
}
