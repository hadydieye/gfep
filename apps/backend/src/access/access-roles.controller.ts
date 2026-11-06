import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { ACCESS_ROLES, SUPER_ADMIN } from '../rbac/roles.js';
import { AccessRolesService } from './access-roles.service.js';
import type { RoleDetailDto, RoleSummaryDto } from './dto/access-response.dto.js';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto.js';

@Controller('access/roles')
export class AccessRolesController {
  constructor(private readonly rolesService: AccessRolesService) {}

  @Get()
  @Roles(...ACCESS_ROLES)
  @Permission('roles', 'read')
  findAll(): Promise<RoleSummaryDto[]> {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Roles(...ACCESS_ROLES)
  @Permission('roles', 'read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoleDetailDto> {
    return this.rolesService.findOne(id, user);
  }

  // Matrice modifiable par le SUPER_ADMIN seul (M18)
  @Put(':id/permissions')
  @Roles(SUPER_ADMIN)
  @Permission('roles', 'write')
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<RoleDetailDto> {
    return this.rolesService.updatePermissions(id, dto, user, request.ip ?? 'unknown');
  }
}
