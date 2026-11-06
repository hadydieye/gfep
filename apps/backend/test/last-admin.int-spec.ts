import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthEventType, PrismaClient, UserStatus } from '@prisma/client';
import request from 'supertest';
import { LOCK_DURATION_MS } from '../src/auth/auth.service.js';
import { CREDENTIALS, createTestApp, login, nextIp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 2.4 — dernier SUPER_ADMIN actif (M17, R18.5, design §6.2 bis). Cadre de
 * laboratoire : le verrouillage automatique s'applique aussi à ce compte, pour que
 * le brute force reste démontrable ; un tiers ne peut ni le suspendre ni le rétrograder.
 */
describe('Dernier SUPER_ADMIN actif (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let itAdmin: string;
  let directorId: string;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    itAdmin = await sessionCookie(app, CREDENTIALS.itAdmin);
    directorId = (await prisma.user.findUniqueOrThrow({ where: { username: CREDENTIALS.admin.username } })).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const server = () => request(app.getHttpServer());
  const director = () => prisma.user.findUniqueOrThrow({ where: { id: directorId }, include: { userRoles: { include: { role: true } } } });
  const activeSuperAdmins = () =>
    prisma.user.count({ where: { status: UserStatus.ACTIVE, userRoles: { some: { role: { name: 'SUPER_ADMIN' } } } } });
  const failLogins = async (username: string, times: number, ip = nextIp()) => {
    for (let i = 0; i < times; i += 1) {
      expect((await login(app, { username, password: 'mauvais' }, ip)).status).toBe(401);
    }
  };
  /** Simule l'écoulement des 15 minutes du verrou (I14) en vieillissant l'événement ACCOUNT_LOCKED. */
  const ageLock = (userId: string) =>
    prisma.authEvent.updateMany({
      where: { userId, eventType: AuthEventType.ACCOUNT_LOCKED },
      data: { timestamp: new Date(Date.now() - LOCK_DURATION_MS - 60_000) },
    });

  it('un tiers ne peut ni suspendre, ni rétrograder, ni déverrouiller le dernier SA actif (403, rien n’est modifié)', async () => {
    expect(await activeSuperAdmins()).toBe(1);
    const superAdminRoleId = (await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } })).id;
    const employeeRoleId = (await prisma.role.findUniqueOrThrow({ where: { name: 'EMPLOYEE' } })).id;
    const responses = await Promise.all([
      server().patch(`/api/v1/access/users/${directorId}/status`).set('Cookie', itAdmin).send({ status: 'SUSPENDED' }),
      server().put(`/api/v1/access/users/${directorId}/roles`).set('Cookie', itAdmin).send({ roleIds: [employeeRoleId] }),
      server().put(`/api/v1/access/users/${directorId}/roles`).set('Cookie', itAdmin).send({ roleIds: [superAdminRoleId, employeeRoleId] }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403]);
    const after = await director();
    expect(after.status).toBe(UserStatus.ACTIVE);
    expect(after.userRoles.map(({ role }) => role.name)).toEqual(['SUPER_ADMIN']);
    // Suspension par la fiche employé (M16) : même garde-fou
    const employee = await prisma.employee.findFirstOrThrow({ where: { identity: { is: { userId: directorId } } } });
    const hr = await sessionCookie(app, CREDENTIALS.hr);
    expect((await server().patch(`/api/v1/employees/${employee.id}/status`).set('Cookie', hr).send({ status: 'SUSPENDED' })).status).toBe(403);
    expect((await director()).status).toBe(UserStatus.ACTIVE);
  });

  it('verrouillé au 5e échec consécutif (I14), même s’il est le dernier SA actif ; le bon mot de passe est alors refusé', async () => {
    await failLogins(CREDENTIALS.admin.username, 4);
    expect((await director()).status).toBe(UserStatus.ACTIVE);
    await failLogins(CREDENTIALS.admin.username, 1);
    expect((await director()).status).toBe(UserStatus.LOCKED);
    expect(await prisma.authEvent.count({ where: { userId: directorId, eventType: AuthEventType.ACCOUNT_LOCKED } })).toBe(1);
    expect((await login(app, CREDENTIALS.admin, nextIp())).status).toBe(401);
  });

  it('pendant le verrou : le déverrouillage manuel par l’ITA ne s’applique pas (403)', async () => {
    expect((await server().post(`/api/v1/access/users/${directorId}/unlock`).set('Cookie', itAdmin)).status).toBe(403);
    expect((await director()).status).toBe(UserStatus.LOCKED);
  });

  it('le verrou expire après 15 minutes : la connexion réussit et le compteur repart à zéro', async () => {
    await ageLock(directorId);
    const response = await login(app, CREDENTIALS.admin, nextIp());
    expect(response.status).toBe(200);
    const after = await director();
    expect(after.status).toBe(UserStatus.ACTIVE);
    expect(after.failedLoginCount).toBe(0);
  });

  it('le rate limiting par IP (5 / 15 min) reste actif sur ce compte', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i += 1) {
      await login(app, { username: CREDENTIALS.admin.username, password: 'mauvais' }, ip);
    }
    expect((await login(app, CREDENTIALS.admin, ip)).status).toBe(429);
    // Remise en état : expiration du verrou posé par ces 5 échecs
    await ageLock(directorId);
    expect((await login(app, CREDENTIALS.admin, nextIp())).status).toBe(200);
  });

  it('avec plusieurs SA actifs, le verrouillage s’applique de la même façon', async () => {
    const admin = await sessionCookie(app, CREDENTIALS.admin);
    const superAdminRoleId = (await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } })).id;
    const second = await prisma.user.findUniqueOrThrow({ where: { username: 'k.bangoura' } });
    expect(
      (await server().put(`/api/v1/access/users/${second.id}/roles`).set('Cookie', admin).send({ roleIds: [superAdminRoleId] })).status,
    ).toBe(200);
    expect(await activeSuperAdmins()).toBe(2);
    await failLogins(CREDENTIALS.admin.username, 5);
    expect((await director()).status).toBe(UserStatus.LOCKED);
    await ageLock(directorId);
    expect((await login(app, CREDENTIALS.admin, nextIp())).status).toBe(200);
  });

  it('deux SA qui se suspendent mutuellement en même temps : au moins un SA actif reste', async () => {
    const second = await prisma.user.findUniqueOrThrow({ where: { username: 'k.bangoura' } });
    const [adminCookie, secondCookie] = await Promise.all([
      sessionCookie(app, CREDENTIALS.admin),
      sessionCookie(app, { username: 'k.bangoura', password: 'GF_Emp2026!' }), // promu SA par l'API : mot de passe inchangé
    ]);
    const responses = await Promise.all([
      server().patch(`/api/v1/access/users/${second.id}/status`).set('Cookie', adminCookie).send({ status: 'SUSPENDED' }),
      server().patch(`/api/v1/access/users/${directorId}/status`).set('Cookie', secondCookie).send({ status: 'SUSPENDED' }),
    ]);
    const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
    // Une suspension aboutit ; l'autre est refusée (dernier SA actif, ou conflit de sérialisation)
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    expect(await activeSuperAdmins()).toBe(1);
  });
});
