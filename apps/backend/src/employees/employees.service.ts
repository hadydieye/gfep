import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
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

    const employee = await this.withUniqueConflict(async () =>
      this.prisma.employee.create({
        data: {
          employeeNumber: await this.nextEmployeeNumber(),
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
      throw new BadRequestException('Un employé ne peut pas être son propre responsable.');
    }
    await this.assertReferences(
      dto.departmentId ?? existing.departmentId,
      dto.positionId ?? existing.positionId,
      dto.managerId,
    );

    const employee = await this.withUniqueConflict(() =>
      this.prisma.employee.update({
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
      }),
    );
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
    if (!department) throw new BadRequestException('Département inexistant.');
    if (!position) throw new BadRequestException('Poste inexistant.');
    if (position.departmentId !== departmentId) {
      throw new BadRequestException("Le poste n'appartient pas au département choisi.");
    }
    if (managerId && !manager) throw new BadRequestException('Responsable inexistant.');
  }

  // Format GF-{AAAA}-{NNN} : count(employees) + 1, en sautant les numéros déjà pris
  private async nextEmployeeNumber(): Promise<string> {
    const year = new Date().getFullYear();
    let sequence = (await this.prisma.employee.count()) + 1;
    for (;;) {
      const candidate = `GF-${year}-${String(sequence).padStart(3, '0')}`;
      const taken = await this.prisma.employee.findUnique({
        where: { employeeNumber: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
      sequence += 1;
    }
  }

  private async withUniqueConflict<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un employé avec cet email professionnel existe déjà.');
      }
      throw error;
    }
  }
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
