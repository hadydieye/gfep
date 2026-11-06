import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdAuthController } from './ad-auth.controller.js';
import { AdAuthService } from './ad-auth.service.js';
import { AdMappingsController } from './ad-mappings.controller.js';
import { AdMappingsService } from './ad-mappings.service.js';
import { AdStatusService } from './ad-status.service.js';
import { LdapClientFactory, LdapjsClientFactory } from './ldap-client.js';

// AdAuthService n'est appelé par aucun autre contrôleur (R31.1) ; AdStatusService sert le dashboard
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdAuthController, AdMappingsController],
  providers: [
    AdAuthService,
    AdMappingsService,
    AdStatusService,
    { provide: LdapClientFactory, useClass: LdapjsClientFactory },
  ],
  exports: [AdStatusService],
})
export class AdAuthModule {}
