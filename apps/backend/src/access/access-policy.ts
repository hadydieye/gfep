import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { SUPER_ADMIN } from '../rbac/roles.js';

/**
 * Garde-fous d'anti-escalade (gfep-mvp2/DECISIONS.md M17), partagés par la
 * gestion des comptes (/access/users) et le changement de statut d'un employé,
 * qui suspend le compte lié (M16). Chaque refus est un 403 générique.
 */
export interface AccountTarget {
  id: string;
  roles: readonly string[];
}

export function holdsSuperAdmin(roles: readonly string[]): boolean {
  return roles.includes(SUPER_ADMIN);
}

/** Personne ne modifie ses propres rôles ni son propre statut, ni ne se déverrouille. */
export function isSelf(actor: AuthenticatedUser, targetUserId: string): boolean {
  return actor.id === targetUserId;
}

/** Seul un SUPER_ADMIN agit sur un compte SUPER_ADMIN (M17, étendu à tout rôle non SA). */
export function actsOnSuperAdminWithoutBeingOne(actor: AuthenticatedUser, target: AccountTarget): boolean {
  return holdsSuperAdmin(target.roles) && !holdsSuperAdmin(actor.roles);
}

/**
 * Dernier SUPER_ADMIN actif : le compte détient SUPER_ADMIN et aucun autre compte
 * SUPER_ADMIN n'est ACTIVE. Un tiers ne peut alors ni le suspendre, ni le réactiver,
 * ni le déverrouiller, ni lui retirer SUPER_ADMIN.
 */
export function isLastActiveSuperAdmin(target: AccountTarget, otherActiveSuperAdmins: number): boolean {
  return holdsSuperAdmin(target.roles) && otherActiveSuperAdmins === 0;
}

export function countOtherActiveSuperAdmins(
  tx: Prisma.TransactionClient,
  targetUserId: string,
): Promise<number> {
  return tx.user.count({
    where: {
      id: { not: targetUserId },
      status: UserStatus.ACTIVE,
      userRoles: { some: { role: { name: SUPER_ADMIN } } },
    },
  });
}

/** Garde-fous communs à toute action sur un compte : soi-même, SUPER_ADMIN, dernier SUPER_ADMIN actif. */
export async function assertMayManageAccount(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedUser,
  target: AccountTarget,
  options: { protectsLastSuperAdmin: boolean },
): Promise<void> {
  if (isSelf(actor, target.id)) throw new ForbiddenException();
  if (actsOnSuperAdminWithoutBeingOne(actor, target)) throw new ForbiddenException();
  if (
    options.protectsLastSuperAdmin &&
    isLastActiveSuperAdmin(target, await countOtherActiveSuperAdmins(tx, target.id))
  ) {
    throw new ForbiddenException();
  }
}

export const STATE_CONFLICT_MESSAGE = "Cette action n'est pas possible dans l'état actuel.";

/**
 * Exécute une écriture sur des comptes en isolation SERIALIZABLE : deux actions
 * simultanées (ex. deux SUPER_ADMIN qui se suspendent mutuellement) ne peuvent pas
 * contourner le garde-fou « dernier SUPER_ADMIN actif ». Un conflit renvoie 409.
 */
export async function runSerializable<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ConflictException(STATE_CONFLICT_MESSAGE);
    }
    throw error;
  }
}
