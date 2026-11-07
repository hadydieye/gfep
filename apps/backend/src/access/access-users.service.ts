import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthProvider, NotificationType, Prisma, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildOrderBy } from '../common/sorting.js';
import { ACCOUNT_DEFAULT_ORDER, ACCOUNT_SORTS, ACCOUNT_SORT_TIEBREAKER } from './account-sorting.js';
import { SUPER_ADMIN, roleLabel } from '../rbac/roles.js';
import {
  STATE_CONFLICT_MESSAGE,
  actsOnSuperAdminWithoutBeingOne,
  assertMayManageAccount,
  holdsSuperAdmin,
  isLastActiveSuperAdmin,
  isSelf,
  runSerializable,
} from './access-policy.js';
import type { AccountDto, PaginatedAccountsDto } from './dto/access-response.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto.js';
import { SelfAssignRoleDto } from './dto/self-assign-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';

export const AD_ROLES_MESSAGE = "Les rôles de ce compte sont gérés par l'annuaire d'entreprise.";

const ACCOUNT_INCLUDE = {
  userRoles: { include: { role: true } },
  employeeIdentity: { include: { employee: { include: { department: { select: { id: true, name: true, code: true } } } } } },
} satisfies Prisma.UserInclude;

type AccountWithRelations = Prisma.UserGetPayload<{ include: typeof ACCOUNT_INCLUDE }>;

/**
 * Gestion des comptes (M17, T2.4.R2) : aucune création de compte. Attribution de
 * rôles, suspension et réactivation, déverrouillage manuel ; chaque opération est
 * auditée et soumise aux garde-fous d'anti-escalade.
 */
@Injectable()
export class AccessUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: ListUsersQueryDto, actor: AuthenticatedUser): Promise<PaginatedAccountsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const terms = query.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.UserWhereInput = {
      AND: [
        query.roleId ? { userRoles: { some: { roleId: query.roleId } } } : {},
        query.status ? { status: query.status } : {},
        query.authProvider ? { authProvider: query.authProvider } : {},
        ...terms.map((term) => ({
          OR: [
            { username: { contains: term, mode: 'insensitive' as const } },
            { email: { contains: term, mode: 'insensitive' as const } },
            { employeeIdentity: { is: { employee: { firstName: { contains: term, mode: 'insensitive' as const } } } } },
            { employeeIdentity: { is: { employee: { lastName: { contains: term, mode: 'insensitive' as const } } } } },
          ],
        })),
      ],
    };
    const [users, total, activeSuperAdminIds] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy: buildOrderBy(query, ACCOUNT_SORTS, ACCOUNT_SORT_TIEBREAKER, ACCOUNT_DEFAULT_ORDER),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
      this.activeSuperAdminIds(this.prisma),
    ]);
    return { data: users.map((user) => toAccount(user, actor, activeSuperAdminIds)), total, page, limit };
  }

  /** Remplace les rôles d'un compte. Audit `role.assign` et `role.remove` par rôle. */
  async updateRoles(
    id: string,
    dto: UpdateUserRolesDto,
    actor: AuthenticatedUser,
    sourceIp: string,
  ): Promise<AccountDto> {
    await runSerializable(this.prisma, async (tx) => {
      const target = await this.loadAccount(tx, id);
      const currentRoles = target.userRoles.map(({ role }) => role);
      if (isSelf(actor, id)) throw new ForbiddenException();
      // Les rôles d'un compte AD sont resynchronisés depuis les groupes à chaque connexion (`05` §5.2)
      if (target.authProvider === AuthProvider.ACTIVE_DIRECTORY) throw new ConflictException(AD_ROLES_MESSAGE);

      const wanted = await tx.role.findMany({ where: { id: { in: dto.roleIds } } });
      if (wanted.length !== dto.roleIds.length) throw new BusinessRuleException('Rôle inexistant.');
      const currentIds = new Set(currentRoles.map((role) => role.id));
      const wantedIds = new Set(wanted.map((role) => role.id));
      const added = wanted.filter((role) => !currentIds.has(role.id));
      const removed = currentRoles.filter((role) => !wantedIds.has(role.id));
      const touchesSuperAdmin = [...added, ...removed].some((role) => role.name === SUPER_ADMIN);

      const targetRoles = currentRoles.map((role) => role.name);
      // Seul un SUPER_ADMIN agit sur un compte SUPER_ADMIN, et attribue ou retire SUPER_ADMIN
      if (actsOnSuperAdminWithoutBeingOne(actor, { id, roles: targetRoles })) throw new ForbiddenException();
      if (touchesSuperAdmin && !holdsSuperAdmin(actor.roles)) throw new ForbiddenException();
      if (removed.some((role) => role.name === SUPER_ADMIN)) {
        await assertMayManageAccount(tx, actor, { id, roles: targetRoles }, { protectsLastSuperAdmin: true });
      }
      if (added.length === 0 && removed.length === 0) return;

      await tx.userRole.deleteMany({ where: { userId: id, roleId: { in: removed.map((role) => role.id) } } });
      await tx.userRole.createMany({
        data: added.map((role) => ({ userId: id, roleId: role.id, assignedBy: actor.id })),
      });
      for (const role of added) {
        await this.audit.record(tx, entry(actor, 'role.assign', id, sourceIp, { username: target.username, role: role.name }));
      }
      for (const role of removed) {
        await this.audit.record(tx, entry(actor, 'role.remove', id, sourceIp, { username: target.username, role: role.name }));
      }
      // M19 : l'utilisateur concerné est notifié, dans la transaction du changement
      const changes = [
        added.length > 0 ? `attribué : ${added.map((role) => roleLabel(role.name)).join(', ')}` : '',
        removed.length > 0 ? `retiré : ${removed.map((role) => roleLabel(role.name)).join(', ')}` : '',
      ].filter(Boolean);
      await this.notifications.notify(tx, [id], {
        type: NotificationType.ROLE_CHANGED,
        title: 'Vos rôles ont changé',
        message: `Rôle ${changes.join(' ; rôle ')}. Vos droits d'accès sont mis à jour immédiatement.`,
      });
    });
    return this.findAccount(id, actor);
  }

  /**
   * GFEP-610 : self-service de rôle — un utilisateur peut faire évoluer ses propres
   * rôles pour débloquer une fonctionnalité sans passer par un administrateur.
   * Audit `role.self_assign` dans la transaction.
   */
  async selfAssignRole(
    id: string,
    dto: SelfAssignRoleDto,
    actor: AuthenticatedUser,
    sourceIp: string,
  ): Promise<AccountDto> {
    await this.prisma.$transaction(async (tx) => {
      const target = await this.loadAccount(tx, id);
      const wanted = await tx.role.findMany({ where: { id: { in: dto.roleIds } } });
      if (wanted.length !== dto.roleIds.length) throw new BusinessRuleException('Rôle inexistant.');

      const currentIds = new Set(target.userRoles.map(({ role }) => role.id));
      const added = wanted.filter((role) => !currentIds.has(role.id));
      const wantedIds = new Set(wanted.map((role) => role.id));
      const removed = target.userRoles
        .map(({ role }) => role)
        .filter((role) => !wantedIds.has(role.id));
      if (added.length === 0 && removed.length === 0) return;

      await tx.userRole.deleteMany({
        where: { userId: id, roleId: { in: removed.map((role) => role.id) } },
      });
      await tx.userRole.createMany({
        data: added.map((role) => ({ userId: id, roleId: role.id, assignedBy: actor.id })),
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'role.self_assign',
        resourceType: 'User',
        resourceId: id,
        sourceIp,
        newValues: {
          username: target.username,
          added: added.map((role) => role.name),
          removed: removed.map((role) => role.name),
        },
      });
    });
    return this.findAccount(id, actor);
  }

  /** Suspension (révoque les sessions) ou réactivation d'un compte. */
  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actor: AuthenticatedUser,
    sourceIp: string,
  ): Promise<AccountDto> {
    await runSerializable(this.prisma, async (tx) => {
      const target = await this.loadAccount(tx, id);
      await assertMayManageAccount(tx, actor, accountTarget(target), { protectsLastSuperAdmin: true });
      // ACTIVE ou LOCKED → SUSPENDED ; SUSPENDED → ACTIVE. Un compte LOCKED se déverrouille via /unlock.
      const allowed =
        dto.status === UserStatus.SUSPENDED ? target.status !== UserStatus.SUSPENDED : target.status === UserStatus.SUSPENDED;
      if (!allowed) throw new ConflictException(STATE_CONFLICT_MESSAGE);

      const updated = await tx.user.updateMany({
        where: { id, status: target.status },
        data: dto.status === UserStatus.ACTIVE ? { status: UserStatus.ACTIVE, failedLoginCount: 0 } : { status: dto.status },
      });
      if (updated.count !== 1) throw new ConflictException(STATE_CONFLICT_MESSAGE);
      const revokedSessions =
        dto.status === UserStatus.SUSPENDED
          ? (await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })).count
          : 0;
      await this.audit.record(tx, {
        ...entry(actor, dto.status === UserStatus.SUSPENDED ? 'user.suspend' : 'user.reactivate', id, sourceIp, {
          username: target.username,
          status: dto.status,
          revokedSessions,
        }),
        oldValues: { status: target.status },
      });
    });
    return this.findAccount(id, actor);
  }

  /** Déverrouillage manuel (T2.4.R2) : LOCKED → ACTIVE, compteur d'échecs à 0. */
  async unlock(id: string, actor: AuthenticatedUser, sourceIp: string): Promise<AccountDto> {
    await runSerializable(this.prisma, async (tx) => {
      const target = await this.loadAccount(tx, id);
      // Ne s'applique pas au dernier SUPER_ADMIN actif : expiration du verrou (I14) ou seed de développement
      await assertMayManageAccount(tx, actor, accountTarget(target), { protectsLastSuperAdmin: true });
      const updated = await tx.user.updateMany({
        where: { id, status: UserStatus.LOCKED },
        data: { status: UserStatus.ACTIVE, failedLoginCount: 0 },
      });
      if (updated.count !== 1) throw new ConflictException(STATE_CONFLICT_MESSAGE);
      await this.audit.record(tx, {
        ...entry(actor, 'user.unlock', id, sourceIp, { username: target.username, status: UserStatus.ACTIVE, failedLoginCount: 0 }),
        oldValues: { status: target.status, failedLoginCount: target.failedLoginCount },
      });
    });
    return this.findAccount(id, actor);
  }

  private async findAccount(id: string, actor: AuthenticatedUser): Promise<AccountDto> {
    const [user, activeSuperAdminIds] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id }, include: ACCOUNT_INCLUDE }),
      this.activeSuperAdminIds(this.prisma),
    ]);
    return toAccount(user, actor, activeSuperAdminIds);
  }

  private async loadAccount(tx: Prisma.TransactionClient, id: string): Promise<AccountWithRelations> {
    const user = await tx.user.findUnique({ where: { id }, include: ACCOUNT_INCLUDE });
    if (!user) throw new NotFoundException('Compte introuvable.');
    return user;
  }

  private async activeSuperAdminIds(client: Prisma.TransactionClient | PrismaService): Promise<Set<string>> {
    const users = await client.user.findMany({
      where: { status: UserStatus.ACTIVE, userRoles: { some: { role: { name: SUPER_ADMIN } } } },
      select: { id: true },
    });
    return new Set(users.map(({ id }) => id));
  }
}

function accountTarget(user: AccountWithRelations) {
  return { id: user.id, roles: user.userRoles.map(({ role }) => role.name) };
}

function entry(
  actor: AuthenticatedUser,
  action: string,
  resourceId: string,
  sourceIp: string,
  newValues: Prisma.InputJsonObject,
) {
  return { actorId: actor.id, action, resourceType: 'User', resourceId, sourceIp, newValues };
}

function hasPermission(actor: AuthenticatedUser, action: string): boolean {
  return actor.permissions.some((p) => p.resource === 'users' && p.action === action);
}

/** Capacités affichées par l'interface : mêmes règles que le service, le serveur reste seul juge. */
function toAccount(user: AccountWithRelations, actor: AuthenticatedUser, activeSuperAdminIds: Set<string>): AccountDto {
  const target = accountTarget(user);
  const otherActiveSuperAdmins = [...activeSuperAdminIds].filter((id) => id !== user.id).length;
  const manageable = !isSelf(actor, user.id) && !actsOnSuperAdminWithoutBeingOne(actor, target);
  const protectedLastAdmin = isLastActiveSuperAdmin(target, otherActiveSuperAdmins);
  const employee = user.employeeIdentity?.employee ?? null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: employee ? `${employee.firstName} ${employee.lastName}` : null,
    department: employee?.department ?? null,
    roles: user.userRoles
      .map(({ role }) => ({ id: role.id, name: role.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    status: user.status,
    authProvider: user.authProvider,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    capabilities: {
      canAssignRoles:
        hasPermission(actor, 'assign_role') && manageable && user.authProvider === AuthProvider.LOCAL,
      canChangeStatus: hasPermission(actor, 'suspend') && manageable && !protectedLastAdmin,
      canUnlock:
        hasPermission(actor, 'unlock') && manageable && !protectedLastAdmin && user.status === UserStatus.LOCKED,
    },
  };
}
