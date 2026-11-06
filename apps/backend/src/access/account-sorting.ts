import type { Prisma } from '@prisma/client';
import type { SortMap } from '../common/sorting.js';

type OrderBy = Prisma.UserOrderByWithRelationInput;

/** Colonnes triables de `GET /access/users` (N6, design §3.2). */
export const ACCOUNT_SORTS: SortMap<OrderBy> = {
  username: (order) => [{ username: order }],
  status: (order) => [{ status: order }],
  authProvider: (order) => [{ authProvider: order }],
  lastLoginAt: (order) => [{ lastLoginAt: { sort: order, nulls: 'last' } }],
  createdAt: (order) => [{ createdAt: order }],
};
export const ACCOUNT_SORT_TIEBREAKER: OrderBy[] = [{ id: 'asc' }];
export const ACCOUNT_DEFAULT_ORDER: OrderBy[] = [{ username: 'asc' }];
