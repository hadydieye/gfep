import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ALL_ROLES, SUPER_ADMIN } from '../rbac/roles.js';
import type { PermissionDto, RoleDetailDto, RoleSummaryDto } from './dto/access-response.dto.js';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto.js';

const ROLE_ORDER: readonly string[] = ALL_ROLES;
const ROLE_COUNTS = { _count: { select: { userRoles: true, rolePermissions: true } } } as const;

/** Matrice rôle ↔ permission (M18) : lecture SA et ITA, modification par le SUPER_ADMIN seul. */
@Injectable()
export class AccessRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(): Promise<RoleSummaryDto[]> {
    const roles = await this.prisma.role.findMany({ include: ROLE_COUNTS });
    return roles
      .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
      .map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        userCount: role._count.userRoles,
        permissionCount: role._count.rolePermissions,
      }));
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<RoleDetailDto> {
    const [role, catalog] = await Promise.all([
      this.prisma.role.findUnique({ where: { id }, include: { ...ROLE_COUNTS, rolePermissions: true } }),
      this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] }),
    ]);
    if (!role) throw new NotFoundException('Rôle introuvable.');
    const permissionIds = role.rolePermissions.map(({ permissionId }) => permissionId);
    const editable = canWriteRoles(actor) && role.name !== SUPER_ADMIN;
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      userCount: role._count.userRoles,
      permissionCount: role._count.rolePermissions,
      permissionIds,
      catalog: catalog.map(toPermissionDto),
      editable,
      lockedPermissionIds: actor.roles.includes(role.name) ? permissionIds : [],
    };
  }

  async updatePermissions(
    id: string,
    dto: UpdateRolePermissionsDto,
    actor: AuthenticatedUser,
    sourceIp: string,
  ): Promise<RoleDetailDto> {
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id },
        include: { rolePermissions: { include: { permission: true } } },
      });
      if (!role) throw new NotFoundException('Rôle introuvable.');
      // Le rôle SUPER_ADMIN détient toujours toutes les permissions et n'est pas modifiable
      if (role.name === SUPER_ADMIN) throw new ForbiddenException();

      const wanted = await tx.permission.findMany({ where: { id: { in: dto.permissionIds } } });
      if (wanted.length !== dto.permissionIds.length) throw new BusinessRuleException('Permission inexistante.');

      const current = new Set(role.rolePermissions.map(({ permissionId }) => permissionId));
      const next = new Set(dto.permissionIds);
      const removed = [...current].filter((permissionId) => !next.has(permissionId));
      const added = [...next].filter((permissionId) => !current.has(permissionId));
      // Personne ne retire une permission d'un rôle qu'il détient lui-même
      if (removed.length > 0 && actor.roles.includes(role.name)) throw new ForbiddenException();
      if (removed.length === 0 && added.length === 0) return;

      await tx.rolePermission.deleteMany({ where: { roleId: id, permissionId: { in: removed } } });
      await tx.rolePermission.createMany({ data: added.map((permissionId) => ({ roleId: id, permissionId })) });
      await this.audit.record(tx, {
        actorId: actor.id,
        action: 'role.permissions_update',
        resourceType: 'Role',
        resourceId: id,
        sourceIp,
        oldValues: { name: role.name, permissions: keys(role.rolePermissions.map(({ permission }) => permission)) },
        newValues: { name: role.name, permissions: keys(wanted) },
      });
      // Notification ROLE_CHANGED à chaque titulaire du rôle (M18, M19) : branchée à l'étape 2.5
    });
    return this.findOne(id, actor);
  }
}

function canWriteRoles(actor: AuthenticatedUser): boolean {
  return actor.permissions.some((p) => p.resource === 'roles' && p.action === 'write');
}

function rank(name: string): number {
  const index = ROLE_ORDER.indexOf(name);
  return index === -1 ? ROLE_ORDER.length : index;
}

function keys(permissions: Array<{ resource: string; action: string }>): string[] {
  return permissions.map(({ resource, action }) => `${resource}:${action}`).sort();
}

function toPermissionDto(permission: PermissionDto): PermissionDto {
  return {
    id: permission.id,
    resource: permission.resource,
    action: permission.action,
    description: permission.description,
  };
}
