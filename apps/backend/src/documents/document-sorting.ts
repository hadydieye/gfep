import type { Prisma } from '@prisma/client';
import type { SortMap } from '../common/sorting.js';

type OrderBy = Prisma.DocumentOrderByWithRelationInput;

/** Colonnes triables de `GET /documents` (N6, design §3.2). */
export const DOCUMENT_SORTS: SortMap<OrderBy> = {
  title: (order) => [{ title: order }],
  category: (order) => [{ category: { name: order } }],
  confidentiality: (order) => [{ confidentialityLevel: order }],
  validationStatus: (order) => [{ validationStatus: order }],
  createdAt: (order) => [{ createdAt: order }],
};
export const DOCUMENT_SORT_TIEBREAKER: OrderBy[] = [{ id: 'asc' }];
export const DOCUMENT_DEFAULT_ORDER: OrderBy[] = [{ createdAt: 'desc' }];
