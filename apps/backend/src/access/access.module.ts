import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccessRolesController } from './access-roles.controller.js';
import { AccessRolesService } from './access-roles.service.js';
import { AccessUsersController } from './access-users.controller.js';
import { AccessUsersService } from './access-users.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AccessRolesController, AccessUsersController],
  providers: [AccessRolesService, AccessUsersService],
})
export class AccessModule {}
