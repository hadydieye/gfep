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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { EMPLOYEE_WRITE_ROLES, READ_ROLES } from '../rbac/roles.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { EmployeeResponseDto, PaginatedEmployeesDto } from './dto/employee-response.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto.js';
import { EmployeesService } from './employees.service.js';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles(...READ_ROLES)
  @Permission('employees', 'read')
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedEmployeesDto> {
    return this.employeesService.findAll(query);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @Permission('employees', 'read')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeResponseDto> {
    return this.employeesService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @Permission('employees', 'write')
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @Permission('employees', 'write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.update(id, dto, user);
  }

  // Report T2.4.R1 (M16) : suspension, sortie ou réactivation d'un employé
  @Patch(':id/status')
  @Roles(...EMPLOYEE_WRITE_ROLES)
  @Permission('employees', 'status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<EmployeeResponseDto> {
    return this.employeesService.changeStatus(id, dto, user, request.ip ?? 'unknown');
  }
}
