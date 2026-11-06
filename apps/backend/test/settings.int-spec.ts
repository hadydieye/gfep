import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { SESSION_TTL_HOURS_DEFAULT, SESSION_TTL_HOURS_KEY } from '../src/settings/settings.service.js';
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
 * Etape 3.2 - module /admin/settings (T3.2.7 - gfep-mvp3 N16).
 * Couvre GET /admin/settings et PATCH /admin/settings.
 */
type Role = keyof typeof CREDENTIALS;
const ROLES = Object.keys(CREDENTIALS) as Role[];

describe('Parametres systeme (integration)', () => {
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

  const getSettings = (cookie?: string) => {
    const req = request(app.getHttpServer()).get('/api/v1/admin/settings');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  const patchSettings = (body: object, cookie?: string) => {
    const req = request(app.getHttpServer()).patch('/api/v1/admin/settings').send(body);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  // -------------------------------------------------------
  // GET /admin/settings
  // -------------------------------------------------------

  describe('GET /admin/settings', () => {
    it('401 sans session', async () => {
      expect((await getSettings()).status).toBe(401);
    });

    it('200 pour SUPER_ADMIN, 403 pour les 7 autres roles', async () => {
      for (const role of ROLES) {
        const res = await getSettings(sessions[role]);
        expect({ role, status: res.status }).toEqual({
          role,
          status: role === 'admin' ? 200 : 403,
        });
      }
    });

    it('renvoie la configuration effective avec les valeurs par defaut', async () => {
      await prisma.systemSetting.deleteMany();
      const res = await getSettings(sessions.admin);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        sessionTtlHours: SESSION_TTL_HOURS_DEFAULT,
        maxFailedLogins: 5,
        lockDurationMs: 15 * 60 * 1000,
        loginRateLimit: { limit: 5, windowMs: 900_000 },
        passwordChangeRateLimit: { limit: 5, windowMs: 900_000 },
        maxUploadBytes: 10 * 1024 * 1024,
        allowedMimeTypes: expect.arrayContaining(['application/pdf']),
        adStatus: expect.stringMatching(/^(UP|DOWN|NOT_CONFIGURED)$/),
        appVersion: expect.any(String),
      });
    });
  });

  // -------------------------------------------------------
  // PATCH /admin/settings
  // -------------------------------------------------------

  describe('PATCH /admin/settings', () => {
    beforeEach(async () => {
      await prisma.systemSetting.deleteMany();
    });

    it('401 sans session', async () => {
      expect((await patchSettings({ sessionTtlHours: 4 })).status).toBe(401);
    });

    it('403 pour les roles non SUPER_ADMIN', async () => {
      for (const role of ROLES.filter((r) => r !== 'admin')) {
        const res = await patchSettings({ sessionTtlHours: 4 }, sessions[role]);
        expect({ role, status: res.status }).toEqual({ role, status: 403 });
      }
    });

    it('valeurs invalides -> 400 (0, 13, 2.5)', async () => {
      for (const value of [0, 13, 2.5]) {
        const res = await patchSettings({ sessionTtlHours: value }, sessions.admin);
        expect({ value, status: res.status }).toEqual({ value, status: 400 });
      }
    });

    it('200, nouvelle valeur retournee et persistee', async () => {
      const res = await patchSettings({ sessionTtlHours: 4 }, sessions.admin);
      expect(res.status).toBe(200);
      expect(res.body.sessionTtlHours).toBe(4);
      const row = await prisma.systemSetting.findUnique({ where: { key: SESSION_TTL_HOURS_KEY } });
      expect(row).not.toBeNull();
    });

    it('la nouvelle duree s\'applique aux nouvelles sessions (expiresAt et Max-Age du cookie)', async () => {
      await patchSettings({ sessionTtlHours: 2 }, sessions.admin);

      const before = Date.now();
      const loginRes = await login(app, CREDENTIALS.employee, nextIp());
      expect(loginRes.status).toBe(200);
      const after = Date.now();

      const token = sessionTokenFrom(loginRes)!;
      const { createHash } = await import('crypto');
      const hash = createHash('sha256').update(token).digest('hex');
      const session = await prisma.session.findUnique({ where: { sessionTokenHash: hash } });
      expect(session).not.toBeNull();
      const expiresMs = session!.expiresAt.getTime();
      const expected = 2 * 3600_000;
      expect(expiresMs - before).toBeGreaterThan(expected - 10_000);
      expect(expiresMs - after).toBeLessThan(expected + 10_000);

      const setCookieHeader = (loginRes.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith(`${SESSION_COOKIE}=`),
      );
      expect(setCookieHeader).toBeDefined();
      const maxAgeMatch = setCookieHeader!.match(/Max-Age=(\d+)/i);
      expect(maxAgeMatch).not.toBeNull();
      expect(Number(maxAgeMatch![1])).toBe(2 * 3600);
    });

    it('les sessions existantes gardent leur expiration d\'origine', async () => {
      const existingLogin = await login(app, CREDENTIALS.itTech, nextIp());
      const token = sessionTokenFrom(existingLogin)!;
      const { createHash } = await import('crypto');
      const hash = createHash('sha256').update(token).digest('hex');
      const sessionBefore = await prisma.session.findUnique({ where: { sessionTokenHash: hash } });
      const originalExpiry = sessionBefore!.expiresAt.getTime();

      await patchSettings({ sessionTtlHours: 3 }, sessions.admin);

      const sessionAfter = await prisma.session.findUnique({ where: { sessionTokenHash: hash } });
      expect(sessionAfter!.expiresAt.getTime()).toBe(originalExpiry);
    });

    it('audit setting.update ecrit avec ancienne et nouvelle valeur', async () => {
      await prisma.auditLog.deleteMany({ where: { action: 'setting.update' } });
      const admin = await prisma.user.findUniqueOrThrow({ where: { username: CREDENTIALS.admin.username } });

      await patchSettings({ sessionTtlHours: 6 }, sessions.admin);

      const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'setting.update' } });
      expect(log).toMatchObject({
        actorId: admin.id,
        resourceType: 'SystemSetting',
        resourceId: SESSION_TTL_HOURS_KEY,
      });
      expect((log.oldValues as Record<string, unknown>).sessionTtlHours).toBe(SESSION_TTL_HOURS_DEFAULT);
      expect((log.newValues as Record<string, unknown>).sessionTtlHours).toBe(6);
    });

    it('champ inconnu -> 400', async () => {
      const res = await patchSettings({ sessionTtlHours: 4, unknown: 'hack' }, sessions.admin);
      expect(res.status).toBe(400);
    });
  });
});
