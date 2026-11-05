import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { EmployeeResponseDto, PaginatedEmployeesDto } from './dto/employee-response.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { EmployeesService } from './employees.service.js';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')
  @Permission('employees', 'read')
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedEmployeesDto> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')
  @Permission('employees', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeResponseDto> {
    return this.employeesService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER')
  @Permission('employees', 'write')
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.create(dto, user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER')
  @Permission('employees', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.update(id, dto, user);
  }
}
