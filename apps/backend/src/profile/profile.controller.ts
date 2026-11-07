import { Body, Controller, Get, HttpCode, Patch, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { PROFILE_ROLES } from '../rbac/roles.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto.js';
import { ProfileResponseDto } from './dto/profile-response.dto.js';
import { ProfileService } from './profile.service.js';
import { UserThrottlerGuard } from './user-throttler.guard.js';

/** Profil de l'utilisateur connecté (AppFlow §3.11, N15) : jamais d'identifiant en paramètre. */
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @Roles(...PROFILE_ROLES)
  @Permission('profile', 'read')
  get(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponseDto> {
    return this.profileService.get(user);
  }

  // GFEP-655 : l'employé met à jour sa propre fiche (N15) sans passer par les RH
  @Patch('employee')
  @Roles(...PROFILE_ROLES)
  @Permission('profile', 'update')
  updateEmployee(
    @Body() dto: UpdateOwnProfileDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<ProfileResponseDto> {
    return this.profileService.updateEmployee(user, dto, request.ip ?? 'unknown');
  }

  @Patch('password')
  @HttpCode(204)
  @Roles(...PROFILE_ROLES)
  @Permission('profile', 'update')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ 'password-change': { limit: 5, ttl: 900000 } })
  @SkipThrottle({ login: true, 'login-ad': true })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<void> {
    return this.profileService.changePassword(user, dto, request.ip ?? 'unknown');
  }
}
