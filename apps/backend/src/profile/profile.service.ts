import { ConflictException, Injectable } from '@nestjs/common';
import { AuthProvider, NotificationType } from '@prisma/client';
import * as argon2 from 'argon2';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { checkPasswordPolicy } from '../auth/password-policy.js';
import { AuditService } from '../audit/audit.service.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { ProfileResponseDto } from './dto/profile-response.dto.js';

export const WRONG_CURRENT_PASSWORD = 'Mot de passe actuel incorrect.';
export const DIRECTORY_ACCOUNT_PASSWORD = "Le mot de passe d'un compte d'entreprise se gère dans l'annuaire.";

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Profil de l'utilisateur connecté uniquement (N15) : aucun identifiant n'est accepté en entrée. */
  async get(user: AuthenticatedUser): Promise<ProfileResponseDto> {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        userRoles: { include: { role: true } },
        employeeIdentity: {
          include: {
            employee: {
              include: {
                department: { select: { id: true, name: true } },
                position: { select: { title: true } },
                manager: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    const employee = account.employeeIdentity?.employee;
    return {
      account: {
        id: account.id,
        username: account.username,
        email: account.email,
        authProvider: account.authProvider,
        roles: account.userRoles.map(({ role }) => role.name),
        lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
      },
      employee: employee
        ? {
            id: employee.id,
            employeeNumber: employee.employeeNumber,
            firstName: employee.firstName,
            lastName: employee.lastName,
            professionalEmail: employee.professionalEmail,
            phone: employee.phone,
            department: employee.department,
            position: employee.position.title,
            manager: employee.manager,
            hireDate: employee.hireDate.toISOString(),
          }
        : null,
    };
  }

  /**
   * Changement de mot de passe (N14), comptes LOCAL uniquement. Un mot de passe
   * actuel erroné ne compte pas dans `failedLoginCount` (la limitation par
   * compte du throttler `password-change` borne les essais). En cas de succès,
   * dans une transaction : nouveau hash, révocation des autres sessions, audit
   * sans valeur de mot de passe, notification SECURITY.
   */
  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto, sourceIp: string): Promise<void> {
    const account = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { employeeIdentity: { include: { employee: { select: { firstName: true, lastName: true } } } } },
    });
    if (account.authProvider !== AuthProvider.LOCAL || !account.passwordHash) {
      throw new ConflictException(DIRECTORY_ACCOUNT_PASSWORD);
    }
    if (!(await argon2.verify(account.passwordHash, dto.currentPassword))) {
      throw new BusinessRuleException(WRONG_CURRENT_PASSWORD);
    }
    const employee = account.employeeIdentity?.employee;
    const violation = checkPasswordPolicy(dto.newPassword, {
      current: dto.currentPassword,
      username: account.username,
      firstName: employee?.firstName,
      lastName: employee?.lastName,
    });
    if (violation) throw new BusinessRuleException(violation);

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: account.id }, data: { passwordHash } });
      const revoked = await tx.session.updateMany({
        where: { userId: account.id, revokedAt: null, id: { not: user.sessionId } },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, {
        actorId: account.id,
        action: 'user.password_change',
        resourceType: 'User',
        resourceId: account.id,
        sourceIp,
        newValues: { revokedSessions: revoked.count },
      });
      await this.notifications.notify(tx, [account.id], {
        type: NotificationType.SECURITY,
        title: 'Mot de passe modifié',
        message:
          'Le mot de passe de votre compte vient d’être modifié et vos autres sessions ont été fermées. ' +
          "Si vous n'êtes pas à l'origine de ce changement, prévenez immédiatement l'administrateur informatique.",
      });
    });
  }
}
