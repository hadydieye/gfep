import { applyDecorators } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';

/**
 * Tri par colonne côté serveur (N6) : `?sort=<clé>&order=asc|desc`.
 *
 * Chaque endpoint déclare une table de correspondance clé publique → `orderBy`
 * Prisma (liste blanche). Une clé hors table est refusée par la validation (400
 * générique, I17). Une clé de départage stable est toujours ajoutée pour une
 * pagination déterministe. Sans `sort`, l'ordre par défaut de l'endpoint
 * s'applique, inchangé.
 */
export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export type SortMap<T> = Readonly<Record<string, (order: SortOrder) => T[]>>;

export interface SortQuery {
  sort?: string;
  order?: SortOrder;
}

/** Décorateurs de validation d'un champ `sort` limité aux clés de `map`. */
export function IsSortKey(map: SortMap<unknown>): PropertyDecorator {
  return applyDecorators(IsOptional(), IsIn(Object.keys(map)));
}

/** Décorateurs de validation du champ `order`. */
export function IsSortOrder(): PropertyDecorator {
  return applyDecorators(IsOptional(), IsIn(SORT_ORDERS));
}

export function buildOrderBy<T>(
  query: SortQuery,
  map: SortMap<T>,
  tiebreaker: T[],
  defaults: T[],
): T[] {
  // Object.hasOwn : une clé héritée (`toString`…) n'est jamais une colonne
  const build = query.sort && Object.hasOwn(map, query.sort) ? map[query.sort] : undefined;
  if (!build) return defaults;
  return [...build(query.order ?? 'asc'), ...tiebreaker];
}
