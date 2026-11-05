import { Injectable } from '@nestjs/common';
import { EmploymentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEPARTMENT_MANAGER, SUPER_ADMIN, primaryRole } from '../rbac/roles.js';
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

    return { role, indicators, recentActivity: [] };
  }
}
