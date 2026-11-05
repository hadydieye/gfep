import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/permission.decorator.js';
import { isAuthenticatedOnlyRoute, isPublicRoute } from '../route-access.js';

/** Guard global : une route non publique sans @Permission() est refusée (interdiction par défaut). */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (isPublicRoute(this.reflector, context)) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<Request>();
    if (!user) {
      throw new UnauthorizedException();
    }
    if (isAuthenticatedOnlyRoute(this.reflector, context)) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      throw new ForbiddenException();
    }
    const granted = user.permissions.some(
      (p) => p.resource === required.resource && p.action === required.action,
    );
    if (!granted) {
      throw new ForbiddenException();
    }
    return true;
  }
}
