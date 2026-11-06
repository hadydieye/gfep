import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import type { FinanceUserDto } from './dto/finance-response.dto.js';

export const DEPARTMENT_SELECT = { select: { id: true, name: true, code: true } } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Intervalle de dates inclusif (AAAA-MM-JJ, UTC) en filtre Prisma, ou undefined. */
export function dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from.slice(0, 10)}T00:00:00.000Z`) } : {}),
    ...(to ? { lt: new Date(new Date(`${to.slice(0, 10)}T00:00:00.000Z`).getTime() + DAY_MS) } : {}),
  };
}

/** Comptes créateurs (createdBy n'a pas de relation Prisma) : identifiant et nom de connexion. */
export async function loadUsers(
  prisma: Pick<PrismaClient, 'user'> | Prisma.TransactionClient,
  ids: readonly string[],
): Promise<Map<string, FinanceUserDto>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, username: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

export function hasPermission(user: AuthenticatedUser, resource: string, action: string): boolean {
  return user.permissions.some((p) => p.resource === resource && p.action === action);
}

export function financeAuditEntry(
  user: AuthenticatedUser,
  action: string,
  resourceType: 'Transaction' | 'Invoice',
  resourceId: string,
  sourceIp: string,
) {
  return { actorId: user.id, action, resourceType, resourceId, sourceIp };
}
