import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator.js';
import { AUTHENTICATED_ONLY_KEY } from './decorators/authenticated-only.decorator.js';

const flag = (reflector: Reflector, key: string, context: ExecutionContext) =>
  reflector.getAllAndOverride<boolean | undefined>(key, [
    context.getHandler(),
    context.getClass(),
  ]) === true;

export const isPublicRoute = (reflector: Reflector, context: ExecutionContext) =>
  flag(reflector, IS_PUBLIC_KEY, context);

export const isAuthenticatedOnlyRoute = (reflector: Reflector, context: ExecutionContext) =>
  flag(reflector, AUTHENTICATED_ONLY_KEY, context);
