import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardResponseDto } from './dto/dashboard-response.dto.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')
  @Permission('dashboard', 'read')
  getDashboard(@CurrentUser() user: AuthenticatedUser): Promise<DashboardResponseDto> {
    return this.dashboardService.getIndicators(user);
  }
}
