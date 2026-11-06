import { Body, Controller, Get, HttpCode, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { SETTINGS_ROLES } from '../rbac/roles.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import type { EffectiveConfiguration } from './settings.service.js';
import { SettingsService } from './settings.service.js';

/** Paramètres système (N16) : lecture et modification de la durée de session. */
@Controller('admin/settings')
@Roles(...SETTINGS_ROLES)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Permission('settings', 'read')
  get(): Promise<EffectiveConfiguration> {
    return this.settings.effectiveConfiguration();
  }

  @Patch()
  @HttpCode(200)
  @Permission('settings', 'write')
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<EffectiveConfiguration> {
    return this.settings.update(dto, user.id, req.ip ?? 'unknown');
  }
}
