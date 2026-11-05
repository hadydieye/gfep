import { Injectable } from '@nestjs/common';
import { DocumentValidationStatus, EmploymentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEPARTMENT_MANAGER, SUPER_ADMIN, primaryRole } from '../rbac/roles.js';
import { buildVisibilityWhere } from '../documents/document-access.js';
import { DashboardResponseDto } from './dto/dashboard-response.dto.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getIndicators(user: AuthenticatedUser): Promise<DashboardResponseDto> {
    const role = primaryRole(user);
    const indicators: DashboardResponseDto['indicators'] = {};

    if (role === SUPER_ADMIN) {
      indicators.totalEmployees = await this.prisma.employee.count({
        where: { employmentStatus: EmploymentStatus.ACTIVE },
      });
    } else if (role === DEPARTMENT_MANAGER && user.employeeIdentity) {
      const department = await this.prisma.department.findUnique({
        where: { id: user.employeeIdentity.departmentId },
        select: {
          name: true,
          _count: {
            select: { employees: { where: { employmentStatus: EmploymentStatus.ACTIVE } } },
          },
        },
      });
      if (department) {
        indicators.departmentEmployees = department._count.employees;
        indicators.departmentName = department.name;
      }
    }

    const [recentDocuments, pendingDocuments] = await Promise.all([
      role === 'EMPLOYEE'
        ? this.prisma.document.findMany({
            where: buildVisibilityWhere(user),
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : Promise.resolve(undefined),
      role === DEPARTMENT_MANAGER && user.employeeIdentity
        ? this.prisma.document.findMany({
            where: {
              AND: [
                buildVisibilityWhere(user),
                { validationStatus: DocumentValidationStatus.PENDING },
                {
                  OR: [
                    { category: { is: { departmentId: user.employeeIdentity.departmentId } } },
                    {
                      category: { is: { departmentId: null } },
                      owner: { is: { departmentId: user.employeeIdentity.departmentId } },
                    },
                  ],
                },
              ],
            },
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve(undefined),
    ]);

    return {
      role,
      indicators,
      recentActivity: [],
      ...(recentDocuments ? { recentDocuments: recentDocuments.map(withIsoDate) } : {}),
      ...(pendingDocuments ? { pendingDocuments: pendingDocuments.map(withIsoDate) } : {}),
    };
  }
}

function withIsoDate(document: { id: string; title: string; createdAt: Date }) {
  return { ...document, createdAt: document.createdAt.toISOString() };
}
