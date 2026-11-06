import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, NotificationType, Prisma, UserStatus } from '@prisma/client';
import { STATE_CONFLICT_MESSAGE, assertMayManageAccount, runSerializable } from '../access/access-policy.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { writeScopeDepartmentId } from '../rbac/roles.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { EmployeeResponseDto, PaginatedEmployeesDto } from './dto/employee-response.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto.js';

const EMPLOYEE_INCLUDE = {
  department: { select: { id: true, name: true, code: true } },
  position: { select: { id: true, title: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmployeeInclude;

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{ include: typeof EMPLOYEE_INCLUDE }>;

// Nouveaux essais si deux créations simultanées obtiennent le même numéro
export const MAX_EMPLOYEE_NUMBER_ATTEMPTS = 5;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: PaginationQueryDto): Promise<PaginatedEmployeesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    // Chaque mot recherché doit correspondre au prénom ou au nom (ex. "Mamadou Diallo")
    const terms = query.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    const where: Prisma.EmployeeWhereInput = {
      AND: terms.map((term) => ({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
        ],
      })),
      departmentId: query.departmentId,
      employmentStatus: query.status,
    };

    const [employees, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: EMPLOYEE_INCLUDE,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data: employees.map(toResponse), total, page, limit };
  }

  async findOne(id: string): Promise<EmployeeResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: EMPLOYEE_INCLUDE,
    });
    if (!employee) {
      throw new NotFoundException('Employé introuvable.');
    }
    return toResponse(employee);
  }

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser, sourceIp = 'unknown'): Promise<EmployeeResponseDto> {
    const scopeDepartmentId = writeScopeDepartmentId(user);
    if (scopeDepartmentId && dto.departmentId !== scopeDepartmentId) {
      throw new ForbiddenException();
    }
    await this.assertReferences(dto.departmentId, dto.positionId, dto.managerId);

    for (let attempt = 1; ; attempt += 1) {
      try {
        const employee = await this.prisma.$transaction(async (tx) => {
          const created = await tx.employee.create({
            data: {
              employeeNumber: await nextEmployeeNumber(tx),
              firstName: dto.firstName,
              lastName: dto.lastName,
              professionalEmail: dto.professionalEmail,
              phone: dto.phone ?? null,
              departmentId: dto.departmentId,
              positionId: dto.positionId,
              managerId: dto.managerId ?? null,
              hireDate: new Date(dto.hireDate),
            },
            include: EMPLOYEE_INCLUDE,
          });
          // R26.1 (étape 2.6) : création auditée dans la transaction
          await this.audit.record(tx, {
            actorId: user.id,
            action: 'employee.create',
            resourceType: 'Employee',
            resourceId: created.id,
            sourceIp,
            newValues: employeeAuditValues(created),
          });
          // M19, AppFlow §6 : le responsable désigné est notifié, s'il a un compte
          if (created.managerId) {
            const manager = await tx.employeeIdentity.findUnique({
              where: { employeeId: created.managerId },
              select: { userId: true },
            });
            await this.notifications.notify(tx, manager ? [manager.userId] : [], {
              type: NotificationType.INFO,
              title: 'Nouvel employé dans votre équipe',
              message:
                `${created.firstName} ${created.lastName} (${created.employeeNumber}) rejoint votre équipe ` +
                `comme « ${created.position.title} », département ${created.department.name}.`,
            });
          }
          return created;
        });
        return toResponse(employee);
      } catch (error) {
        if (uniqueTarget(error)?.includes('employeeNumber') && attempt < MAX_EMPLOYEE_NUMBER_ATTEMPTS) {
          continue;
        }
        throw translateUniqueViolation(error);
      }
    }
  }

  async update(
    id: string,
    dto: UpdateEmployeeDto,
    user: AuthenticatedUser,
    sourceIp = 'unknown',
  ): Promise<EmployeeResponseDto> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Employé introuvable.');
    }

    const scopeDepartmentId = writeScopeDepartmentId(user);
    if (
      scopeDepartmentId &&
      (existing.departmentId !== scopeDepartmentId ||
        (dto.departmentId !== undefined && dto.departmentId !== scopeDepartmentId))
    ) {
      throw new ForbiddenException();
    }
    if (dto.managerId === id) {
      throw new BusinessRuleException('Un employé ne peut pas être son propre responsable.');
    }
    await this.assertReferences(
      dto.departmentId ?? existing.departmentId,
      dto.positionId ?? existing.positionId,
      dto.managerId,
    );

    const employee = await this.prisma
      .$transaction(async (tx) => {
        const updated = await tx.employee.update({
          where: { id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            professionalEmail: dto.professionalEmail,
            phone: dto.phone,
            departmentId: dto.departmentId,
            positionId: dto.positionId,
            managerId: dto.managerId,
            hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          },
          include: EMPLOYEE_INCLUDE,
        });
        // R26.1 (étape 2.6) : seuls les champs modifiés, avant et après
        const before = employeeAuditValues(existing);
        const after = employeeAuditValues(updated);
        const changed = (Object.keys(after) as Array<keyof typeof after>).filter((key) => before[key] !== after[key]);
        await this.audit.record(tx, {
          actorId: user.id,
          action: 'employee.update',
          resourceType: 'Employee',
          resourceId: id,
          sourceIp,
          oldValues: Object.fromEntries(changed.map((key) => [key, before[key]])),
          newValues: Object.fromEntries(changed.map((key) => [key, after[key]])),
        });
        return updated;
      })
      .catch((error: unknown) => {
        throw translateUniqueViolation(error);
      });
    return toResponse(employee);
  }

  /**
   * Changement de statut (M16, T2.4.R1). SUSPENDED ou TERMINATED suspend aussi le
   * compte lié et révoque ses sessions, dans une seule transaction avec l'audit.
   * ACTIVE ne réactive que la fiche : le compte se réactive via /access/users.
   */
  async changeStatus(
    id: string,
    dto: UpdateEmployeeStatusDto,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<EmployeeResponseDto> {
    return runSerializable(this.prisma, async (tx) => {
      const existing = await tx.employee.findUnique({
        where: { id },
        include: { identity: { include: { user: { include: { userRoles: { include: { role: true } } } } } } },
      });
      if (!existing) throw new NotFoundException('Employé introuvable.');
      // Interdit de changer son propre statut (M16)
      if (user.employeeIdentity?.employeeId === id) throw new ForbiddenException();
      const scopeDepartmentId = writeScopeDepartmentId(user);
      if (scopeDepartmentId && existing.departmentId !== scopeDepartmentId) throw new ForbiddenException();
      if (existing.employmentStatus === dto.status) throw new ConflictException(STATE_CONFLICT_MESSAGE);

      const account = existing.identity?.user ?? null;
      const suspendsAccount = dto.status !== EmploymentStatus.ACTIVE && account !== null;
      // La suspension du compte lié suit les garde-fous de M17 (SUPER_ADMIN, dernier SUPER_ADMIN actif)
      if (suspendsAccount) {
        await assertMayManageAccount(
          tx,
          user,
          { id: account.id, roles: account.userRoles.map(({ role }) => role.name) },
          { protectsLastSuperAdmin: true },
        );
      }

      await tx.employee.update({ where: { id }, data: { employmentStatus: dto.status } });
      let revokedSessions = 0;
      if (suspendsAccount) {
        await tx.user.update({ where: { id: account.id }, data: { status: UserStatus.SUSPENDED } });
        revokedSessions = (
          await tx.session.updateMany({
            where: { userId: account.id, revokedAt: null },
            data: { revokedAt: new Date() },
          })
        ).count;
      }
      await this.audit.record(tx, {
        actorId: user.id,
        action: 'employee.status_change',
        resourceType: 'Employee',
        resourceId: id,
        sourceIp,
        oldValues: {
          employmentStatus: existing.employmentStatus,
          ...(account ? { accountStatus: account.status } : {}),
        },
        newValues: {
          employmentStatus: dto.status,
          ...(account ? { accountStatus: suspendsAccount ? UserStatus.SUSPENDED : account.status } : {}),
          revokedSessions,
        },
      });
      return toResponse(await tx.employee.findUniqueOrThrow({ where: { id }, include: EMPLOYEE_INCLUDE }));
    });
  }

  // Intégrité référentielle : le poste doit appartenir au département, le responsable exister
  private async assertReferences(
    departmentId: string,
    positionId: string,
    managerId: string | null | undefined,
  ) {
    const [department, position, manager] = await Promise.all([
      this.prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } }),
      this.prisma.position.findUnique({ where: { id: positionId }, select: { departmentId: true } }),
      managerId
        ? this.prisma.employee.findUnique({ where: { id: managerId }, select: { id: true } })
        : null,
    ]);
    if (!department) throw new BusinessRuleException('Département inexistant.');
    if (!position) throw new BusinessRuleException('Poste inexistant.');
    if (position.departmentId !== departmentId) {
      throw new BusinessRuleException("Le poste n'appartient pas au département choisi.");
    }
    if (managerId && !manager) throw new BusinessRuleException('Responsable inexistant.');
  }
}

// Format GF-{AAAA}-{NNN} : plus grand suffixe de l'année courante + 1
async function nextEmployeeNumber(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `GF-${new Date().getFullYear()}-`;
  const existing = await tx.employee.findMany({
    where: { employeeNumber: { startsWith: prefix } },
    select: { employeeNumber: true },
  });
  const max = existing.reduce((highest, { employeeNumber }) => {
    const suffix = employeeNumber.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** Colonnes concernées par une violation d'unicité Prisma (P2002), ou undefined. */
function uniqueTarget(error: unknown): string | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return undefined;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.join(',');
  return typeof target === 'string' ? target : '';
}

function translateUniqueViolation(error: unknown): unknown {
  const target = uniqueTarget(error);
  if (target === undefined) return error;
  if (target.includes('professionalEmail')) {
    return new ConflictException('Un employé avec cet email professionnel existe déjà.');
  }
  if (target.includes('employeeNumber')) {
    return new ConflictException("Impossible d'attribuer un numéro d'employé. Réessayez.");
  }
  return new ConflictException('Cette donnée existe déjà.');
}

// Champs de la fiche journalisés (liste blanche Employee de l'AuditService) ; aucun secret
function employeeAuditValues(employee: {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  professionalEmail: string;
  phone: string | null;
  departmentId: string;
  positionId: string;
  managerId: string | null;
  hireDate: Date;
}) {
  return {
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    professionalEmail: employee.professionalEmail,
    phone: employee.phone,
    departmentId: employee.departmentId,
    positionId: employee.positionId,
    managerId: employee.managerId,
    hireDate: employee.hireDate.toISOString().slice(0, 10),
  };
}

function toResponse(employee: EmployeeWithRelations): EmployeeResponseDto {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    firstName: employee.firstName,
    lastName: employee.lastName,
    professionalEmail: employee.professionalEmail,
    phone: employee.phone,
    departmentId: employee.departmentId,
    department: employee.department,
    positionId: employee.positionId,
    position: employee.position,
    managerId: employee.managerId,
    manager: employee.manager,
    employmentStatus: employee.employmentStatus,
    hireDate: employee.hireDate.toISOString(),
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}
