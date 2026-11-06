import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from './authenticated-user.js';
import { AuthService } from './auth.service.js';
import { AuthenticatedOnly } from '../rbac/decorators/authenticated-only.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ login: { limit: 5, ttl: 900000 } })
  @SkipThrottle({ 'login-ad': true, 'password-change': true })
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.login(dto, req, res);
  }

  @Post('logout')
  @HttpCode(204)
  @AuthenticatedOnly()
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.authService.logout(user, req.ip ?? 'unknown', res);
  }

  @Get('me')
  @AuthenticatedOnly()
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthResponseDto> {
    return this.authService.me(user);
  }
}
