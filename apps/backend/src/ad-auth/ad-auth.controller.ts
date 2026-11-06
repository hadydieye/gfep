import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { AuthResponseDto } from '../auth/dto/auth-response.dto.js';
import { AdAuthService } from './ad-auth.service.js';
import { AdLoginDto } from './dto/ad-login.dto.js';

@Controller('auth')
export class AdAuthController {
  constructor(private readonly adAuth: AdAuthService) {}

  // @Public() justifié : point d'entrée d'authentification, équivalent de POST /auth/login (T1).
  // Rate limiting dédié : 5 tentatives / 15 min / IP (TRD §6).
  @Post('login-ad')
  @Public()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ login: true, 'password-change': true })
  @Throttle({ 'login-ad': { limit: 5, ttl: 900000 } })
  login(
    @Body() dto: AdLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.adAuth.login(dto, req, res);
  }
}
