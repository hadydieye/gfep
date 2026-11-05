import { Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DepartmentDetailResponseDto,
  DepartmentResponseDto,
} from './dto/department-response.dto.js';

const ACTIVE = { employmentStatus: EmploymentStatus.ACTIVE } satisfies Prisma.EmployeeWhereInput;

const DEPARTMENT_INCLUDE = {
  manager: { include: { position: true } },
  positions: { select: { id: true, title: true }, orderBy: { hierarchyLevel: 'asc' } },
  _count: { select: { employees: { where: ACTIVE } } },
} satisfies Prisma.DepartmentInclude;

type DepartmentWithRelations = Prisma.DepartmentGetPayload<{
  include: typeof DEPARTMENT_INCLUDE;
}>;

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<DepartmentResponseDto[]> {
    const departments = await this.prisma.department.findMany({
      include: DEPARTMENT_INCLUDE,
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    });
    return departments.map(toResponse);
  }

  async findOne(id: string): Promise<DepartmentDetailResponseDto> {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        ...DEPARTMENT_INCLUDE,
        employees: {
          where: ACTIVE,
          include: { position: true },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
      },
    });
    if (!department) {
      throw new NotFoundException('Département introuvable.');
    }
    return Object.assign(toResponse(department), {
      employees: department.employees.map((employee) => ({
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        position: employee.position.title,
        employmentStatus: employee.employmentStatus,
      })),
    });
  }
}

function toResponse(department: DepartmentWithRelations): DepartmentResponseDto {
  const { manager } = department;
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    description: department.description,
    headcount: department._count.employees,
    manager: manager
      ? {
          id: manager.id,
          firstName: manager.firstName,
          lastName: manager.lastName,
          position: manager.position.title,
        }
      : null,
    positions: department.positions,
    createdAt: department.createdAt.toISOString(),
  };
}
