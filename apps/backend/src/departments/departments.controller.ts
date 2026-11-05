import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { PermissionGuard } from '../rbac/guards/permission.guard.js';
import { RoleGuard } from '../rbac/guards/roles.guard.js';
import { DepartmentsService } from './departments.service.js';
import {
  DepartmentDetailResponseDto,
  DepartmentResponseDto,
} from './dto/department-response.dto.js';

@UseGuards(SessionGuard, RoleGuard, PermissionGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')
  @Permission('departments', 'read')
  findAll(): Promise<DepartmentResponseDto[]> {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')
  @Permission('departments', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<DepartmentDetailResponseDto> {
    return this.departmentsService.findOne(id);
  }
}
