import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { LabLoggerService } from './lab-logger.service.js';
import { LabModeGuard } from './lab-mode.guard.js';
import { LabPingController } from './lab-ping.controller.js';
import { Web01Controller } from './scenarios/web01-sqli/web01.controller.js';
import { Web01Service } from './scenarios/web01-sqli/web01.service.js';

/**
 * Module des vulnérabilités pédagogiques (R-LAB-2) : importé dans AppModule
 * UNIQUEMENT si process.env.LAB_MODE === 'true'. Aucune route de ce module
 * n'existe quand LAB_MODE est absent ou différent de 'true'.
 *
 * Chaque scénario WEB-01 à WEB-08 ajoute son contrôleur et service ici.
 */
@Module({
  imports: [PrismaModule],
  controllers: [LabPingController, Web01Controller],
  providers: [LabLoggerService, LabModeGuard, Web01Service],
  exports: [LabLoggerService, LabModeGuard],
})
export class LabModule {}
