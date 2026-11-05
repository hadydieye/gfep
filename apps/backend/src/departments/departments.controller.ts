import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { DepartmentsService } from './departments.service.js';
import {
  DepartmentDetailResponseDto,
  DepartmentResponseDto,
} from './dto/department-response.dto.js';

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
