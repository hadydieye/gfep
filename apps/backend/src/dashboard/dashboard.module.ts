import { Module } from '@nestjs/common';
import { AdAuthModule } from '../ad-auth/ad-auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [PrismaModule, AdAuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
