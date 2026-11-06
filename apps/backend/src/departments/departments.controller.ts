import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { READ_ROLES } from '../rbac/roles.js';
import { DepartmentsService } from './departments.service.js';
import {
  DepartmentDetailResponseDto,
  DepartmentResponseDto,
} from './dto/department-response.dto.js';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles(...READ_ROLES)
  @Permission('departments', 'read')
  findAll(): Promise<DepartmentResponseDto[]> {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @Permission('departments', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<DepartmentDetailResponseDto> {
    return this.departmentsService.findOne(id);
  }
}
