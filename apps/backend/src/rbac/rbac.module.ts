import { Global, Module } from '@nestjs/common';
import { PermissionGuard } from './guards/permission.guard.js';
import { RoleGuard } from './guards/roles.guard.js';

@Global()
@Module({
  providers: [RoleGuard, PermissionGuard],
  exports: [RoleGuard, PermissionGuard],
})
export class RbacModule {}
