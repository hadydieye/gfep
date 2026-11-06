import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuthEventType, AuthProvider, type Employee, Prisma, SecuritySeverity, UserStatus } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService, GENERIC_AUTH_ERROR } from '../auth/auth.service.js';
import { AuthResponseDto } from '../auth/dto/auth-response.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SECURITY_EVENT_TYPES, SecurityEventsService } from '../security/security-events.service.js';
import { type AdConfig, loadAdConfig } from './ad-config.js';
import { AdLoginDto } from './dto/ad-login.dto.js';
import {
  LdapClientFactory,
  type LdapConnection,
  type LdapEntry,
  LdapInvalidCredentialsError,
  LdapUnavailableError,
  escapeFilterValue,
  readGuid,
  readSid,
} from './ldap-client.js';

/** Message d'AppFlow §3.2 quand l'annuaire est injoignable (503). */
export const AD_UNAVAILABLE_MESSAGE =
  "Service d'authentification d'entreprise indisponible, réessayez plus tard ou utilisez votre compte local";

/**
 * Marque des rôles posés par la synchronisation AD (UserRole.assignedBy).
 * TODO(AD-REVISION) : l'identifiant du compte GFEP est l'identifiant d'annuaire en minuscules ; à confirmer.
 */
export const AD_SYNC_ASSIGNER = 'ad-sync';

/** Refus avec le 401 générique, après écriture de l'AuthEvent de l'étape. */
class AdRefusal extends Error {
  constructor(
    readonly eventType: AuthEventType,
    readonly userId: string | null = null,
  ) {
    super(eventType);
  }
}

/** Annuaire indisponible ou mal configuré : 503, jamais de repli local. */
class AdUnavailable extends Error {
  constructor(
    readonly eventType: AuthEventType,
    readonly reason: string,
  ) {
    super(eventType);
  }
}

type IdentityWithUser = Prisma.EmployeeIdentityGetPayload<{ include: { user: true } }>;

interface DirectoryUser {
  dn: string;
  username: string;
  mail: string | null;
  guid: string | null;
  sid: string | null;
  groups: string[];
}

/**
 * Connexion Active Directory (05 §5.2, design §9.3, M23), contre un LDAP de test
 * en MVP 2. Ordre : bind du compte de service, recherche, bind de l'utilisateur,
 * fiche Employee (GUID, sinon e-mail), groupes → rôles, puis compte et session
 * identiques au flux local. Un AuthEvent distinct par étape ; jamais de repli
 * local ; le mot de passe n'est ni stocké ni journalisé.
 */
@Injectable()
export class AdAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ldap: LdapClientFactory,
    private readonly auth: AuthService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  async login(dto: AdLoginDto, req: Request, res: Response): Promise<AuthResponseDto> {
    const sourceIp = req.ip ?? 'unknown';
    try {
      const configResult = loadAdConfig();
      if (!configResult.ok) {
        throw new AdUnavailable(AuthEventType.AD_UNREACHABLE, `configuration incomplète : ${configResult.problems.join(', ')}`);
      }
      const directoryUser = await this.authenticate(configResult.config, dto);
      const userId = await this.provision(directoryUser, sourceIp, req.headers['user-agent'] ?? 'unknown', res);
      return this.auth.profile(userId);
    } catch (error) {
      if (error instanceof AdRefusal) {
        await this.event(error.eventType, sourceIp, error.userId);
        throw new UnauthorizedException(GENERIC_AUTH_ERROR);
      }
      if (error instanceof AdUnavailable) {
        await this.event(error.eventType, sourceIp);
        if (error.eventType === AuthEventType.AD_UNREACHABLE) {
          await this.securityEvents.record({
            eventType: SECURITY_EVENT_TYPES.AD_UNREACHABLE,
            severity: SecuritySeverity.HIGH,
            source: 'ad-auth',
            description: "L'annuaire d'entreprise est injoignable : connexion AD refusée, sans repli local.",
            metadata: { reason: error.reason, sourceIp },
          });
        }
        throw new ServiceUnavailableException(AD_UNAVAILABLE_MESSAGE);
      }
      throw error;
    }
  }

  /** Étapes 1 à 3 : bind de service, recherche, bind utilisateur. La connexion est toujours fermée. */
  private async authenticate(config: AdConfig, dto: AdLoginDto): Promise<DirectoryUser> {
    const connection = this.ldap.connect(config);
    try {
      // 1. Bind du compte de service (lecture seule)
      await this.step(() => connection.bind(config.bindDn, config.bindPassword), AuthEventType.AD_SERVICE_BIND_FAILED, 'unavailable');

      // 2. Recherche du DN ; identifiant échappé (RFC 4515)
      const attributes = [config.userIdAttribute, config.mailAttribute, config.groupsAttribute, config.guidAttribute];
      if (config.sidAttribute) attributes.push(config.sidAttribute);
      const filter = `(&(objectClass=person)(${config.userIdAttribute}=${escapeFilterValue(dto.username)}))`;
      const entries = await this.step(() => connection.search(config.baseDn, filter, attributes), AuthEventType.AD_UNREACHABLE, 'unavailable');
      // Aucun résultat, ou identifiant ambigu : refus générique
      if (entries.length !== 1) throw new AdRefusal(AuthEventType.AD_USER_NOT_FOUND);
      const entry = entries[0];

      // 3. Bind avec les identifiants de l'utilisateur. Aucun compteur d'échecs local (M23) :
      // TODO(AD-REVISION) : verrouillage et politique de mot de passe délégués à l'AD ; articulation avec les AuthEvent à définir
      await this.step(() => connection.bind(entry.dn, dto.password), AuthEventType.AD_BIND_FAILED, 'refusal');
      return toDirectoryUser(entry, config, dto.username);
    } finally {
      await connection.close().catch(() => undefined);
    }
  }

  /**
   * Exécute une opération LDAP : annuaire injoignable → AD_UNREACHABLE (503) ;
   * identifiants refusés → `onInvalid` (503 pour le compte de service, 401 pour l'utilisateur).
   */
  private async step<T>(operation: () => Promise<T>, onInvalid: AuthEventType, invalidKind: 'unavailable' | 'refusal'): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof LdapInvalidCredentialsError) {
        if (invalidKind === 'refusal') throw new AdRefusal(onInvalid);
        throw new AdUnavailable(onInvalid, 'identifiants du compte de service refusés');
      }
      if (error instanceof LdapUnavailableError) throw new AdUnavailable(AuthEventType.AD_UNREACHABLE, error.reason);
      // Erreur inattendue : nom et message (sans secret), tronqués, pour le diagnostic
      const reason = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : 'erreur inconnue';
      throw new AdUnavailable(AuthEventType.AD_UNREACHABLE, reason);
    }
  }

  /** Étapes 4 à 8 : fiche Employee, rôles mappés, compte, session et cookie. */
  private async provision(directoryUser: DirectoryUser, sourceIp: string, userAgent: string, res: Response): Promise<string> {
    // 4. Fiche Employee : par GUID déjà rattaché, sinon par e-mail = professionalEmail
    // TODO(AD-REVISION) : rattachement provisoire par e-mail ; attribut fiable du vrai annuaire à confirmer
    let employee: Employee | null = null;
    let identity: IdentityWithUser | null = null;
    if (directoryUser.guid) {
      identity = await this.prisma.employeeIdentity.findUnique({
        where: { adObjectGuid: directoryUser.guid },
        include: { user: true },
      });
      if (identity) employee = await this.prisma.employee.findUnique({ where: { id: identity.employeeId } });
    }
    if (!employee && directoryUser.mail) {
      const found = await this.prisma.employee.findFirst({
        where: { professionalEmail: { equals: directoryUser.mail, mode: 'insensitive' } },
        include: { identity: { include: { user: true } } },
      });
      employee = found;
      identity = found?.identity ?? null;
    }
    if (!employee) throw new AdRefusal(AuthEventType.AD_NO_EMPLOYEE_MATCH);
    const resolvedEmployee = employee;

    // Fiche déjà liée à un compte LOCAL : refus, jamais de fusion (M23)
    // TODO(AD-REVISION) : procédure de migration d'un compte LOCAL vers un compte AD à définir
    if (identity && identity.user.authProvider !== AuthProvider.ACTIVE_DIRECTORY) {
      throw new AdRefusal(AuthEventType.AD_LOCAL_ACCOUNT_CONFLICT, identity.userId);
    }
    const existingUserId = identity?.userId ?? null;
    const taken = await this.prisma.user.findFirst({
      where: {
        id: existingUserId ? { not: existingUserId } : undefined,
        OR: [
          { username: directoryUser.username },
          ...(directoryUser.mail ? [{ email: { equals: directoryUser.mail, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { id: true },
    });
    if (taken) throw new AdRefusal(AuthEventType.AD_LOCAL_ACCOUNT_CONFLICT, existingUserId);

    // 5. Groupes (memberOf) → AdGroupRoleMapping → rôles
    // TODO(AD-REVISION) : groupes imbriqués non résolus par memberOf ; groupes de production à définir
    const groups = directoryUser.groups.map((dn) => dn.toLowerCase());
    const mappings = (await this.prisma.adGroupRoleMapping.findMany({ include: { role: true } })).filter((m) =>
      groups.includes(m.adGroupDn.toLowerCase()),
    );
    const roleIds = [...new Set(mappings.map((m) => m.roleId))];
    if (roleIds.length === 0) throw new AdRefusal(AuthEventType.AD_NO_ROLE_MAPPING, existingUserId);

    // Compte AD existant suspendu ou verrouillé : refus (le statut se gère dans /access/users)
    if (identity && identity.user.status !== UserStatus.ACTIVE) {
      throw new AdRefusal(AuthEventType.LOGIN_FAILED, identity.userId);
    }

    // 6 à 8. Compte, rattachement, rôles et session dans une transaction
    const { userId, sessionToken } = await this.prisma.$transaction(async (tx) => {
      const email = directoryUser.mail ?? resolvedEmployee.professionalEmail;
      const user = existingUserId
        ? await tx.user.update({ where: { id: existingUserId }, data: { username: directoryUser.username, email } })
        : await tx.user.create({
            // Aucun mot de passe : l'authentification relève de l'annuaire
            data: { username: directoryUser.username, email, authProvider: AuthProvider.ACTIVE_DIRECTORY, passwordHash: null },
          });
      const link = {
        adObjectGuid: directoryUser.guid,
        adSid: directoryUser.sid,
        adUsername: directoryUser.username,
        adUpn: directoryUser.mail,
        lastSyncAt: new Date(),
      };
      await tx.employeeIdentity.upsert({
        where: { userId: user.id },
        update: link,
        create: { userId: user.id, employeeId: resolvedEmployee.id, ...link },
      });
      // Rôles resynchronisés à chaque connexion (05 §5.2) : ajout et retrait
      // TODO(AD-REVISION) : révocation d'un compte supprimé de l'AD hors connexion non traitée
      await tx.userRole.deleteMany({ where: { userId: user.id, roleId: { notIn: roleIds } } });
      for (const roleId of roleIds) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId } },
          update: {},
          create: { userId: user.id, roleId, assignedBy: AD_SYNC_ASSIGNER },
        });
      }
      const token = await this.auth.openSession(tx, {
        userId: user.id,
        sourceIp,
        userAgent,
        method: AuthProvider.ACTIVE_DIRECTORY,
      });
      return { userId: user.id, sessionToken: token };
    });
    this.auth.setSessionCookie(res, sessionToken);
    return userId;
  }

  private event(eventType: AuthEventType, sourceIp: string, userId: string | null = null) {
    return this.prisma.authEvent.create({
      data: { userId, eventType, sourceIp, authenticationMethod: AuthProvider.ACTIVE_DIRECTORY },
    });
  }
}

function toDirectoryUser(entry: LdapEntry, config: AdConfig, typedUsername: string): DirectoryUser {
  const first = (attribute: string) => entry.values[attribute.toLowerCase()]?.[0] ?? null;
  return {
    dn: entry.dn,
    // TODO(AD-REVISION) : identifiant uid (test) / sAMAccountName (AD)
    username: (first(config.userIdAttribute) ?? typedUsername).toLowerCase(),
    mail: first(config.mailAttribute)?.toLowerCase() ?? null,
    // TODO(AD-REVISION) : entryUUID (test) / objectGUID binaire (AD) ; objectSid absent du LDAP de test
    guid: readGuid(entry, config.guidAttribute),
    sid: readSid(entry, config.sidAttribute),
    groups: entry.values[config.groupsAttribute.toLowerCase()] ?? [],
  };
}

export type { LdapConnection };
