import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Endpoint de santé du module lab (T-INFRA-1) : permet de vérifier
 * que LabModule est bien monté et accessible. @Public() car c'est un
 * health check de lab, pas une route métier — en production, la route
 * n'existe pas (LabModule non importé).
 */
@Controller('lab')
export class LabPingController {
  @Get('ping')
  @Public()
  ping(): { status: string; labMode: boolean } {
    return { status: 'ok', labMode: process.env.LAB_MODE === 'true' };
  }
}
