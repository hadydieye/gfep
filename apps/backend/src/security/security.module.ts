import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SecurityEventsService } from './security-events.service.js';

// Global : l'authentification (et AD en 2.7) écrit des événements de sécurité
@Global()
@Module({
  imports: [PrismaModule],
  providers: [SecurityEventsService],
  exports: [SecurityEventsService],
})
export class SecurityModule {}
