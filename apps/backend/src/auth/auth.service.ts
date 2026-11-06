import { randomBytes } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthEventType, AuthProvider, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import type { CookieOptions, Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AuthenticatedUser,
  USER_AUTH_INCLUDE,
  UserWithAuthRelations,
  collectPermissions,
} from './authenticated-user.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { hashSessionToken, sessionCookieName } from './session.middleware.js';

export const GENERIC_AUTH_ERROR = 'Identifiants invalides.';
export const MAX_FAILED_LOGINS = 5;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 heures (décision C4)
export const LOCK_DURATION_MS = 15 * 60 * 1000; // verrouillage temporaire (décision I14)

@Injectable()
export class AuthService {
  // Hash factice vérifié quand l'utilisateur n'existe pas, pour un temps de réponse homogène
  private readonly dummyHash = argon2.hash(randomBytes(16).toString('hex'));

  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto, req: Request, res: Response): Promise<AuthResponseDto> {
    const sourceIp = req.ip ?? 'unknown';
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: USER_AUTH_INCLUDE,
    });

    if (!user || !user.passwordHash || user.authProvider !== AuthProvider.LOCAL) {
      await argon2.verify(await this.dummyHash, dto.password);
      if (user) await this.authEvent(user.id, AuthEventType.LOGIN_FAILED, sourceIp);
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    // Verrou expiré : déverrouillage au premier essai suivant, compteur remis à zéro
    if (user.status === UserStatus.LOCKED && (await this.lockHasExpired(user.id))) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE, failedLoginCount: 0 },
      });
      user.status = UserStatus.ACTIVE;
      user.failedLoginCount = 0;
    }

    // Compte verrouillé ou suspendu : rejet sans vérifier le mot de passe. La
    // vérification factice garde le même temps de réponse qu'un mauvais mot de passe.
    if (user.status !== UserStatus.ACTIVE) {
      await argon2.verify(await this.dummyHash, dto.password);
      await this.authEvent(user.id, AuthEventType.LOGIN_FAILED, sourceIp);
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      await this.registerFailedAttempt(user.id, sourceIp);
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    const sessionToken = randomBytes(48).toString('hex');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lastLoginAt: new Date() },
      }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          sessionTokenHash: hashSessionToken(sessionToken),
          ipAddress: sourceIp,
          userAgent: req.headers['user-agent'] ?? 'unknown',
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      }),
      this.authEvent(user.id, AuthEventType.LOGIN_SUCCESS, sourceIp),
    ]);

    res.cookie(sessionCookieName(), sessionToken, {
      ...this.cookieOptions(),
      maxAge: SESSION_TTL_MS,
    });
    return this.toResponse(user);
  }

  async logout(user: AuthenticatedUser, sourceIp: string, res: Response): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: user.sessionId },
        data: { revokedAt: new Date() },
      }),
      this.authEvent(user.id, AuthEventType.LOGOUT, sourceIp),
    ]);
    res.clearCookie(sessionCookieName(), this.cookieOptions());
  }

  async me(user: AuthenticatedUser): Promise<AuthResponseDto> {
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: USER_AUTH_INCLUDE,
    });
    if (!fullUser) {
      throw new UnauthorizedException();
    }
    return this.toResponse(fullUser);
  }

  private async registerFailedAttempt(userId: string, sourceIp: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
    await this.authEvent(userId, AuthEventType.LOGIN_FAILED, sourceIp);

    // I14 s'applique à tous les comptes, y compris le dernier SUPER_ADMIN actif (M17) :
    // le brute force reste démontrable. Points d'appel prévus pour ce verrouillage :
    // notification WARNING aux IT_ADMINISTRATOR actifs (étape 2.5) et SecurityEvent
    // account_locked, de sévérité HIGH pour un SUPER_ADMIN (étape 2.6).
    if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: { status: UserStatus.LOCKED },
        }),
        this.authEvent(userId, AuthEventType.ACCOUNT_LOCKED, sourceIp),
      ]);
    }
  }

  // Le verrou expire 15 min après le dernier ACCOUNT_LOCKED ; sans cet événement
  // (verrou posé hors du flux de connexion), le compte reste verrouillé.
  private async lockHasExpired(userId: string): Promise<boolean> {
    const lastLock = await this.prisma.authEvent.findFirst({
      where: { userId, eventType: AuthEventType.ACCOUNT_LOCKED },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    return lastLock !== null && lastLock.timestamp.getTime() + LOCK_DURATION_MS <= Date.now();
  }

  private authEvent(userId: string, eventType: AuthEventType, sourceIp: string) {
    return this.prisma.authEvent.create({
      data: { userId, eventType, sourceIp, authenticationMethod: AuthProvider.LOCAL },
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      // Désactivable uniquement pour un accès HTTP hors localhost en développement
      secure: process.env.SESSION_COOKIE_SECURE !== 'false',
      sameSite: 'strict',
      path: '/',
    };
  }

  private toResponse(user: UserWithAuthRelations): AuthResponseDto {
    const employee = user.employeeIdentity?.employee;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      roles: user.userRoles.map(({ role }) => ({ id: role.id, name: role.name })),
      permissions: collectPermissions(user),
      employee: employee
        ? {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            departmentId: employee.departmentId,
          }
        : null,
    };
  }
}
