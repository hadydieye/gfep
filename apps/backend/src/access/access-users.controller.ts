import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { ACCESS_ROLES, ALL_ROLES } from '../rbac/roles.js';
import { AccessUsersService } from './access-users.service.js';
import type { AccountDto, PaginatedAccountsDto } from './dto/access-response.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto.js';
import { SelfAssignRoleDto } from './dto/self-assign-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';

// Aucune création de compte en MVP 2 (M17)
@Controller('access/users')
export class AccessUsersController {
  constructor(private readonly usersService: AccessUsersService) {}

  @Get()
  @Roles(...ACCESS_ROLES)
  @Permission('users', 'read')
  findAll(
    @Query() query: ListUsersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedAccountsDto> {
    return this.usersService.findAll(query, user);
  }

  @Put(':id/roles')
  @Roles(...ACCESS_ROLES)
  @Permission('users', 'assign_role')
  updateRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AccountDto> {
    return this.usersService.updateRoles(id, dto, user, request.ip ?? 'unknown');
  }

  // GFEP-610 : self-service de rôle — l'utilisateur gère lui-même ses rôles
  @Put(':id/self-assign-role')
  @Roles(...ALL_ROLES)
  @Permission('profile', 'update')
  selfAssignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SelfAssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AccountDto> {
    return this.usersService.selfAssignRole(id, dto, user, request.ip ?? 'unknown');
  }

  @Patch(':id/status')
  @Roles(...ACCESS_ROLES)
  @Permission('users', 'suspend')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AccountDto> {
    return this.usersService.updateStatus(id, dto, user, request.ip ?? 'unknown');
  }

  // Report T2.4.R2 : déverrouillage manuel
  @Post(':id/unlock')
  @HttpCode(200)
  @Roles(...ACCESS_ROLES)
  @Permission('users', 'unlock')
  unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AccountDto> {
    return this.usersService.unlock(id, user, request.ip ?? 'unknown');
  }
}
