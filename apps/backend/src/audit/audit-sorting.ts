import type { Prisma } from '@prisma/client';
import type { SortMap } from '../common/sorting.js';

type AuditOrderBy = Prisma.AuditLogOrderByWithRelationInput;
type SecurityOrderBy = Prisma.SecurityEventOrderByWithRelationInput;
type AuthOrderBy = Prisma.AuthEventOrderByWithRelationInput;

/** Colonnes triables des journaux (N6, design §3.2). */
export const AUDIT_LOG_SORTS: SortMap<AuditOrderBy> = {
  timestamp: (order) => [{ timestamp: order }],
  action: (order) => [{ action: order }],
  actor: (order) => [{ actor: { username: order } }],
};
export const SECURITY_EVENT_SORTS: SortMap<SecurityOrderBy> = {
  timestamp: (order) => [{ timestamp: order }],
  eventType: (order) => [{ eventType: order }],
  severity: (order) => [{ severity: order }],
};
export const AUTH_EVENT_SORTS: SortMap<AuthOrderBy> = {
  timestamp: (order) => [{ timestamp: order }],
  eventType: (order) => [{ eventType: order }],
  user: (order) => [{ user: { username: order } }],
};
export const AUDIT_DEFAULT_ORDER = [{ timestamp: 'desc' as const }, { id: 'desc' as const }];
export const AUDIT_SORT_TIEBREAKER = [{ id: 'asc' as const }];
