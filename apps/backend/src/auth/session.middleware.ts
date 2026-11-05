import { createHash } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { USER_AUTH_INCLUDE, toAuthenticatedUser } from './authenticated-user.js';

export const sessionCookieName = () => process.env.SESSION_COOKIE_NAME ?? 'gfep_session';

export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    req.user = null;
    const token: unknown = req.cookies?.[sessionCookieName()];
    if (typeof token !== 'string' || token.length === 0) {
      return next();
    }

    try {
      const session = await this.prisma.session.findUnique({
        where: { sessionTokenHash: hashSessionToken(token) },
        include: { user: { include: USER_AUTH_INCLUDE } },
      });

      const isValid =
        session !== null &&
        session.revokedAt === null &&
        session.expiresAt > new Date() &&
        session.user.status === UserStatus.ACTIVE;

      if (isValid) {
        req.user = toAuthenticatedUser(session.user, session.id);
      }
      next();
    } catch (error) {
      next(error);
    }
  }
}
