import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { isAuthenticatedOnlyRoute, isPublicRoute } from '../route-access.js';

/** Guard global : une route non publique sans @Roles() est refusée (interdiction par défaut). */
@Injectable()
export class RoleGuard implements CanActivate {
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

    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException();
    }
    if (!requiredRoles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException();
    }
    return true;
  }
}
