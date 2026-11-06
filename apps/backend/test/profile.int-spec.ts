import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthProvider, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PASSWORD_POLICY_MESSAGES as M } from '../src/auth/password-policy.js';
import { WRONG_CURRENT_PASSWORD } from '../src/profile/profile.service.js';
import {
  CREDENTIALS,
  SESSION_COOKIE,
  createTestApp,
  login,
  nextIp,
  resetDatabase,
  seedOrThrow,
  sessionCookie,
  sessionTokenFrom,
  testPrisma,
} from './helpers.js';

/**
 * Etape 3.2 - module /profile (T3.2.3, T3.2.5 - gfep-mvp3 N15, N14).
 * Couvre GET /profile et PATCH /profile/password.
 */
type Role = keyof typeof CREDENTIALS;
const ROLES = Object.keys(CREDENTIALS) as Role[];

describe('Profil utilisateur (integration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const sessions = {} as Record<Role, string>;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    for (const role of ROLES) sessions[role] = await sessionCookie(app, CREDENTIALS[role]);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const get = (cookie?: string) => {
    const req = request(app.getHttpServer()).get('/api/v1/profile');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  const patch = (body: object, cookie?: string, ip = nextIp()) => {
    const req = request(app.getHttpServer())
      .patch('/api/v1/profile/password')
      .set('X-Forwarded-For', ip)
      .send(body);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  // -------------------------------------------------------
  // GET /profile
  // -------------------------------------------------------

  describe('GET /profile', () => {
    it('401 sans session', async () => {
      const res = await get();
      expect(res.status).toBe(401);
    });

    it('200 pour les 8 roles, reponse isolee a chaque compte', async () => {
      for (const role of ROLES) {
        const res = await get(sessions[role]);
        expect({ role, status: res.status }).toEqual({ role, status: 200 });
        expect(res.body.account.username).toBe(CREDENTIALS[role].username);
      }
    });

    it('la reponse contient les donnees du compte et de la fiche employe', async () => {
      const res = await get(sessions.admin);
      expect(res.status).toBe(200);
      const { account, employee } = res.body;
      expect(account).toMatchObject({
        username: CREDENTIALS.admin.username,
        authProvider: 'LOCAL',
        roles: expect.arrayContaining(['SUPER_ADMIN']),
        createdAt: expect.any(String),
      });
      expect(account).not.toHaveProperty('passwordHash');
      expect(account).not.toHaveProperty('sessionToken');
      expect(employee).not.toBeNull();
      expect(employee).toMatchObject({
        firstName: expect.any(String),
        lastName: expect.any(String),
        department: { id: expect.any(String), name: expect.any(String) },
        hireDate: expect.any(String),
      });
    });

    it('ne renvoie que les donnees du compte connecte (isolation)', async () => {
      const adminRes = await get(sessions.admin);
      const employeeRes = await get(sessions.employee);
      expect(adminRes.body.account.username).not.toBe(employeeRes.body.account.username);
      expect(adminRes.body.account.id).not.toBe(employeeRes.body.account.id);
    });
  });

  // -------------------------------------------------------
  // PATCH /profile/password
  // -------------------------------------------------------

  describe('PATCH /profile/password', () => {
    const NEW_PASSWORD = 'Nouveau-Mdp-Test-2026!';

    /** Cree un utilisateur LOCAL avec le role EMPLOYEE (pour avoir profile:update). */
    async function createLocalUser(suffix: string, password = 'Ancien-Mdp-Test-2026!') {
      const employeeRole = await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
      return prisma.user.create({
        data: {
          // Prefixe 'u' + suffixe: evite les tokens qui pourraient se retrouver dans les mots de passe
          username: `u.${suffix}`,
          email: `u.${suffix}@guineasf.com`,
          passwordHash: await argon2.hash(password),
          authProvider: AuthProvider.LOCAL,
          userRoles: { create: { roleId: employeeRole.id, assignedBy: 'system' } },
        },
      });
    }

    /** Supprime proprement l'utilisateur et ses dependances (auditLogs reference l'acteur). */
    async function deleteUser(id: string) {
      await prisma.auditLog.deleteMany({ where: { actorId: id } });
      await prisma.user.delete({ where: { id } });
    }

    it('401 sans session', async () => {
      const res = await patch({ currentPassword: CREDENTIALS.employee.password, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(401);
    });

    it('204 en cas de succes, ancien mot de passe refuse, nouveau accepte', async () => {
      const user = await createLocalUser('changepwd', 'Ancien-Mdp-Test-2026!');
      const cookie = await sessionCookie(app, { username: user.username, password: 'Ancien-Mdp-Test-2026!' });

      const res = await patch(
        { currentPassword: 'Ancien-Mdp-Test-2026!', newPassword: NEW_PASSWORD },
        cookie,
        nextIp(),
      );
      expect(res.status).toBe(204);

      // Ancien mot de passe refuse
      const oldLogin = await login(app, { username: user.username, password: 'Ancien-Mdp-Test-2026!' });
      expect(oldLogin.status).toBe(401);

      // Nouveau mot de passe accepte
      const newLogin = await login(app, { username: user.username, password: NEW_PASSWORD });
      expect(newLogin.status).toBe(200);

      await deleteUser(user.id);
    });

    it('revoque les autres sessions, conserve la session courante', async () => {
      const user = await createLocalUser('revoke', 'Ancien-Mdp-Rv-2026!');
      const ip1 = nextIp();
      const ip2 = nextIp();

      // Ouvrir 3 sessions
      const loginRes1 = await login(app, { username: user.username, password: 'Ancien-Mdp-Rv-2026!' }, ip1);
      const loginRes2 = await login(app, { username: user.username, password: 'Ancien-Mdp-Rv-2026!' }, ip2);
      const loginRes3 = await login(app, { username: user.username, password: 'Ancien-Mdp-Rv-2026!' }, nextIp());

      const token1 = sessionTokenFrom(loginRes1)!;
      const cookie1 = `${SESSION_COOKIE}=${token1}`;
      const cookie2 = `${SESSION_COOKIE}=${sessionTokenFrom(loginRes2)}`;
      const cookie3 = `${SESSION_COOKIE}=${sessionTokenFrom(loginRes3)}`;

      // Changer le mot de passe depuis la session 1
      const res = await patch(
        { currentPassword: 'Ancien-Mdp-Rv-2026!', newPassword: NEW_PASSWORD },
        cookie1,
        ip1,
      );
      expect(res.status).toBe(204);

      // Session 1 (courante) toujours valide
      expect((await request(app.getHttpServer()).get('/api/v1/profile').set('Cookie', cookie1)).status).toBe(200);

      // Sessions 2 et 3 revoquees
      expect((await request(app.getHttpServer()).get('/api/v1/profile').set('Cookie', cookie2)).status).toBe(401);
      expect((await request(app.getHttpServer()).get('/api/v1/profile').set('Cookie', cookie3)).status).toBe(401);

      await deleteUser(user.id);
    });

    it('audit user.password_change avec revokedSessions, sans mot de passe', async () => {
      const user = await createLocalUser('audit', 'Ancien-Mdp-Aud-2026!');
      // Ouvrir une seconde session pour qu'il y ait quelque chose a revoquer
      await login(app, { username: user.username, password: 'Ancien-Mdp-Aud-2026!' }, nextIp());
      const cookie = await sessionCookie(app, { username: user.username, password: 'Ancien-Mdp-Aud-2026!' });

      await prisma.auditLog.deleteMany({ where: { actorId: user.id, action: 'user.password_change' } });
      const res = await patch({ currentPassword: 'Ancien-Mdp-Aud-2026!', newPassword: NEW_PASSWORD }, cookie, nextIp());
      expect(res.status).toBe(204);

      const log = await prisma.auditLog.findFirstOrThrow({
        where: { actorId: user.id, action: 'user.password_change' },
      });
      expect(log).toMatchObject({
        actorId: user.id,
        resourceType: 'User',
        resourceId: user.id,
      });
      expect((log.newValues as Record<string, unknown>).revokedSessions).toBeGreaterThanOrEqual(1);
      // Aucune valeur de mot de passe dans les colonnes oldValues / newValues
      const oldStr = JSON.stringify(log.oldValues ?? null);
      const newStr = JSON.stringify(log.newValues ?? null);
      expect(oldStr).not.toMatch(/hash/i);
      expect(newStr).not.toMatch(/hash/i);
      // Ni newPassword ni currentPassword
      expect(oldStr + newStr).not.toMatch(/newPassword|currentPassword/i);

      await deleteUser(user.id);
    });

    it('notification SECURITY creee apres changement', async () => {
      const user = await createLocalUser('notif', 'Ancien-Mdp-Notif-2026!');
      const cookie = await sessionCookie(app, { username: user.username, password: 'Ancien-Mdp-Notif-2026!' });
      await prisma.notification.deleteMany({ where: { userId: user.id } });

      const res = await patch({ currentPassword: 'Ancien-Mdp-Notif-2026!', newPassword: NEW_PASSWORD }, cookie, nextIp());
      expect(res.status).toBe(204);

      const notif = await prisma.notification.findFirst({ where: { userId: user.id } });
      expect(notif).not.toBeNull();
      expect(notif!.type).toBe('SECURITY');

      await deleteUser(user.id);
    });

    it('mot de passe actuel faux -> 400, failedLoginCount inchange', async () => {
      const user = await createLocalUser('wrongpwd', 'Ancien-Mdp-Wg-2026!');
      const before = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginCount;
      const cookie = await sessionCookie(app, { username: user.username, password: 'Ancien-Mdp-Wg-2026!' });

      const res = await patch({ currentPassword: 'MauvaisMotDePasse!', newPassword: NEW_PASSWORD }, cookie, nextIp());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(WRONG_CURRENT_PASSWORD);

      const after = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).failedLoginCount;
      expect(after).toBe(before);

      await deleteUser(user.id);
    });

    it.each([
      ['trop court', 'Court-11', M.tooShort],
      ['trop long', 'aB3!'.repeat(33), M.tooLong],
      ['identique actuel', 'Ancien-Mdp-Pol-2026!', M.sameAsCurrent],
      ['contient le nom', 'Forteresse-Polytestlast-26', M.personal],
      ['mot courant', 'Password2026!!', M.common],
    ])('regle de politique : %s -> 400 avec message precis', async (_, newPassword, expectedMessage) => {
      const employeeRole = await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
      const ts = Date.now();
      const position = await prisma.position.findFirstOrThrow({ where: { department: { code: 'CF' } } });
      const user = await prisma.user.create({
        data: {
          username: `pol.${ts}`,
          email: `pol.${ts}@guineasf.com`,
          passwordHash: await argon2.hash('Ancien-Mdp-Pol-2026!'),
          authProvider: AuthProvider.LOCAL,
          userRoles: { create: { roleId: employeeRole.id, assignedBy: 'system' } },
          employeeIdentity: {
            create: {
              employee: {
                create: {
                  employeeNumber: `GF-POL-${ts}`,
                  firstName: 'Polytestfirst',
                  lastName: 'Polytestlast',
                  professionalEmail: `pol.emp.${ts}@guineasf.com`,
                  hireDate: new Date('2025-01-01'),
                  department: { connect: { code: 'CF' } },
                  position: { connect: { id: position.id } },
                },
              },
            },
          },
        },
      });
      const cookie = await sessionCookie(app, { username: user.username, password: 'Ancien-Mdp-Pol-2026!' });

      const res = await patch({ currentPassword: 'Ancien-Mdp-Pol-2026!', newPassword }, cookie, nextIp());
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(expectedMessage);

      await deleteUser(user.id);
    });

    it('compte AD -> 409', async () => {
      const employeeRole = await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } });
      const user = await prisma.user.create({
        data: {
          username: 'ad.profile.test',
          email: 'ad.profile.test@guineasf.com',
          authProvider: AuthProvider.ACTIVE_DIRECTORY,
          passwordHash: null,
          userRoles: { create: { roleId: employeeRole.id, assignedBy: 'system' } },
        },
      });
      // Inserer une session directement (pas de connexion par mot de passe pour un compte AD)
      const { randomBytes, createHash } = await import('crypto');
      const token = randomBytes(48).toString('hex');
      const hash = createHash('sha256').update(token).digest('hex');
      await prisma.session.create({
        data: {
          userId: user.id,
          sessionTokenHash: hash,
          ipAddress: nextIp(),
          userAgent: 'test',
          expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
        },
      });
      const adCookie = `${SESSION_COOKIE}=${token}`;

      const res = await patch(
        { currentPassword: 'irrelevant', newPassword: NEW_PASSWORD },
        adCookie,
        nextIp(),
      );
      expect(res.status).toBe(409);

      await deleteUser(user.id);
    });

    it('6e essai en 15 min -> 429 (throttler par compte)', async () => {
      const user = await createLocalUser('throttle', 'Ancien-Mdp-Thr-2026!');
      const cookie = await sessionCookie(app, { username: user.username, password: 'Ancien-Mdp-Thr-2026!' });
      const ip = nextIp();

      // 5 essais avec mauvais mot de passe actuel (chacun compte dans le throttler)
      for (let i = 0; i < 5; i++) {
        const res = await patch({ currentPassword: 'Mauvais!', newPassword: NEW_PASSWORD }, cookie, ip);
        expect(res.status).toBe(400);
      }

      // 6e essai -> 429
      const res = await patch({ currentPassword: 'Mauvais!', newPassword: NEW_PASSWORD }, cookie, ip);
      expect(res.status).toBe(429);

      await deleteUser(user.id);
    });

    it('champ inconnu dans le corps -> 400 generique', async () => {
      const user = await createLocalUser('extrafield', 'Ancien-Mdp-Ef-2026!');
      const cookie = await sessionCookie(app, { username: user.username, password: 'Ancien-Mdp-Ef-2026!' });

      const res = await patch(
        { currentPassword: 'Ancien-Mdp-Ef-2026!', newPassword: NEW_PASSWORD, unknownField: 'hack' },
        cookie,
        nextIp(),
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Donn\u00e9es invalides.');

      await deleteUser(user.id);
    });
  });
});
