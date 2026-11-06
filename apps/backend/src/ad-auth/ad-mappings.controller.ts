import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { ACCESS_ROLES } from '../rbac/roles.js';
import { type AdMappingDto, AdMappingsService } from './ad-mappings.service.js';
import { CreateAdMappingDto } from './dto/create-ad-mapping.dto.js';

// Écran /access/ad-mappings (M22) : IT_ADMINISTRATOR et SUPER_ADMIN
@Controller('access/ad-mappings')
export class AdMappingsController {
  constructor(private readonly mappings: AdMappingsService) {}

  @Get()
  @Roles(...ACCESS_ROLES)
  @Permission('ad_mappings', 'read')
  findAll(): Promise<AdMappingDto[]> {
    return this.mappings.findAll();
  }

  @Post()
  @Roles(...ACCESS_ROLES)
  @Permission('ad_mappings', 'write')
  create(
    @Body() dto: CreateAdMappingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<AdMappingDto> {
    return this.mappings.create(dto, user, request.ip ?? 'unknown');
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...ACCESS_ROLES)
  @Permission('ad_mappings', 'write')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<void> {
    return this.mappings.remove(id, user, request.ip ?? 'unknown');
  }
}
