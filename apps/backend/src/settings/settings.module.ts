import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

// SettingsModule est @Global() : ses exports sont disponibles dans toute l'application
// sans import explicite, notamment dans AuthModule (cycle evite par @Optional()).
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
