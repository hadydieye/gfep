import { createHash, randomBytes } from 'crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient, UserStatus } from '@prisma/client';
import request from 'supertest';
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
  setCookieFrom,
  testPrisma,
} from './helpers.js';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('Authentification (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const me = (cookie?: string) => {
    const req = request(app.getHttpServer()).get('/api/v1/auth/me');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  it('login valide : 200, cookie HttpOnly + Secure + SameSite=Strict, expiration 8 h', async () => {
    const before = Date.now();
    const response = await login(app, CREDENTIALS.admin);

    expect(response.status).toBe(200);
    expect(response.body.username).toBe('m.keita');
    expect(response.body.roles.map((r: { name: string }) => r.name)).toEqual(['SUPER_ADMIN']);

    const cookie = setCookieFrom(response)!;
    expect(cookie).toBeDefined();
    const attributes = cookie.split(';').map((part) => part.trim().toLowerCase());
    expect(attributes).toContain('httponly');
    expect(attributes).toContain('secure');
    expect(attributes).toContain('samesite=strict');
    expect(attributes).toContain(`max-age=${EIGHT_HOURS_MS / 1000}`);

    const session = await prisma.session.findFirstOrThrow({
      where: { user: { username: 'm.keita' } },
      orderBy: { createdAt: 'desc' },
    });
    const ttl = session.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(EIGHT_HOURS_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(EIGHT_HOURS_MS + 60_000);
  });

  it('mauvais mot de passe et utilisateur inconnu : même 401 et même message générique', async () => {
    const wrongPassword = await login(app, { username: 'm.keita', password: 'mauvais' });
    const unknownUser = await login(app, { username: 'inconnu', password: 'mauvais' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(wrongPassword.body.message).toBe('Identifiants invalides.');
    expect(setCookieFrom(wrongPassword)).toBeUndefined();
  });

  it('seul le hash SHA-256 du token de session est stocké en base', async () => {
    const response = await login(app, CREDENTIALS.manager);
    const token = sessionTokenFrom(response)!;
    expect(token).toMatch(/^[0-9a-f]{96}$/);

    expect(await prisma.session.count({ where: { sessionTokenHash: token } })).toBe(0);
    const session = await prisma.session.findUnique({ where: { sessionTokenHash: sha256(token) } });
    expect(session?.userId).toBeDefined();
    expect(JSON.stringify(await prisma.session.findMany())).not.toContain(token);
  });

  it('5 échecs : compte LOCKED, puis refus même avec le bon mot de passe', async () => {
    const ip = nextIp();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login(app, { username: 'm.diallo', password: 'mauvais' }, ip);
      expect(response.status).toBe(401);
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { username: 'm.diallo' } });
    expect(user.status).toBe(UserStatus.LOCKED);
    expect(user.failedLoginCount).toBe(5);
    const events = await prisma.authEvent.findMany({ where: { userId: user.id } });
    expect(events.filter((e) => e.eventType === 'ACCOUNT_LOCKED')).toHaveLength(1);

    // Autre IP pour ne pas être masqué par le rate limiting
    const withGoodPassword = await login(app, CREDENTIALS.employee, nextIp());
    expect(withGoodPassword.status).toBe(401);
    expect(withGoodPassword.body.message).toBe('Identifiants invalides.');
    expect(setCookieFrom(withGoodPassword)).toBeUndefined();
  });

  it('rate limiting : 6e tentative depuis la même IP = 429, une autre IP reste autorisée', async () => {
    const ip = nextIp();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login(app, { username: 'inconnu', password: 'x' }, ip);
      expect(response.status).toBe(401);
    }
    const sixth = await login(app, { username: 'inconnu', password: 'x' }, ip);
    expect(sixth.status).toBe(429);

    const otherIp = await login(app, CREDENTIALS.admin, nextIp());
    expect(otherIp.status).toBe(200);
  });

  it('logout : session révoquée, puis /auth/me renvoie 401', async () => {
    const cookie = await sessionCookie(app, CREDENTIALS.admin);
    expect((await me(cookie)).status).toBe(200);

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);
    expect(logout.status).toBe(204);
    expect(setCookieFrom(logout)).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));

    const token = cookie.split('=')[1];
    const session = await prisma.session.findUniqueOrThrow({
      where: { sessionTokenHash: sha256(token) },
    });
    expect(session.revokedAt).not.toBeNull();
    expect((await me(cookie)).status).toBe(401);
  });

  describe('sessions invalides', () => {
    const insertSession = async (data: { expiresAt: Date; revokedAt?: Date }) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { username: 'm.keita' } });
      const token = randomBytes(48).toString('hex');
      await prisma.session.create({
        data: {
          userId: user.id,
          sessionTokenHash: sha256(token),
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
          ...data,
        },
      });
      return `${SESSION_COOKIE}=${token}`;
    };

    it('session valide insérée directement : acceptée (témoin)', async () => {
      const cookie = await insertSession({ expiresAt: new Date(Date.now() + 60_000) });
      expect((await me(cookie)).status).toBe(200);
    });

    it('session expirée : 401', async () => {
      const cookie = await insertSession({ expiresAt: new Date(Date.now() - 1_000) });
      expect((await me(cookie)).status).toBe(401);
    });

    it('session révoquée : 401', async () => {
      const cookie = await insertSession({
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      });
      expect((await me(cookie)).status).toBe(401);
    });

    it('token inconnu : 401', async () => {
      expect((await me(`${SESSION_COOKIE}=${randomBytes(48).toString('hex')}`)).status).toBe(401);
    });
  });
});
