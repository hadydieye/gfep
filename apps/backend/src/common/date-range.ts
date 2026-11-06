import type { Prisma } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Intervalle de dates inclusif (AAAA-MM-JJ, UTC) en filtre Prisma, ou undefined. */
export function inclusiveDateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from.slice(0, 10)}T00:00:00.000Z`) } : {}),
    ...(to ? { lt: new Date(new Date(`${to.slice(0, 10)}T00:00:00.000Z`).getTime() + DAY_MS) } : {}),
  };
}
