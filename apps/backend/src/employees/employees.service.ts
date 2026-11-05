import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { writeScopeDepartmentId } from '../rbac/roles.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { EmployeeResponseDto, PaginatedEmployeesDto } from './dto/employee-response.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateEmployeeDto, user: AuthenticatedUser): Promise<EmployeeResponseDto> {
    const scopeDepartmentId = writeScopeDepartmentId(user);
    if (scopeDepartmentId && dto.departmentId !== scopeDepartmentId) {
      throw new ForbiddenException();
    }
    await this.assertReferences(dto.departmentId, dto.positionId, dto.managerId);

    for (let attempt = 1; ; attempt += 1) {
      try {
        const employee = await this.prisma.$transaction(async (tx) =>
          tx.employee.create({
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
          }),
        );
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

    const employee = await this.prisma.employee
      .update({
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
      })
      .catch((error: unknown) => {
        throw translateUniqueViolation(error);
      });
    return toResponse(employee);
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
