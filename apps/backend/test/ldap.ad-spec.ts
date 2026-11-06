import { spawnSync } from 'child_process';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthEventType, AuthProvider, PrismaClient, SecuritySeverity } from '@prisma/client';
import request from 'supertest';
import { AD_UNAVAILABLE_MESSAGE } from '../src/ad-auth/ad-auth.service.js';
import { AdStatusService } from '../src/ad-auth/ad-status.service.js';
import { CREDENTIALS, createTestApp, nextIp, resetDatabase, runSeed, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Critère de passage 2.7 (`06` §2.7, R34.1) contre le LDAP de test Docker (`dc=gnpaytrust,dc=local`) :
 * connexion réussie avec mapping groupe → rôle, connexion suivante par GUID, chaque refus, et refus
 * propre (AD_UNREACHABLE) quand le conteneur est arrêté. Jamais un vrai AD.
 */
const PASSWORD = 'AdTest-2026!'; // annuaire de test uniquement (infra/ldap-test/README.md)
const CONTAINER = process.env.LDAP_TEST_CONTAINER ?? 'gfep_ldap_test';

function docker(...args: string[]) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 90_000 });
  if (result.status !== 0) throw new Error(`docker ${args.join(' ')} : ${result.stderr}`);
  return result.stdout;
}

describe('Connexion AD contre le LDAP de test Docker (critère 2.7)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    expect(docker('inspect', '-f', '{{.State.Running}}', CONTAINER).trim(), `conteneur ${CONTAINER} arrêté`).toBe('true');
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    const adSeed = runSeed({}, 'prisma/seed-ad-test.ts');
    expect(adSeed.status, adSeed.stderr).toBe(0);
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const loginAd = (username: string, password = PASSWORD) =>
    request(app.getHttpServer()).post('/api/v1/auth/login-ad').set('X-Forwarded-For', nextIp()).send({ username, password });
  const lastEvent = () =>
    prisma.authEvent.findFirstOrThrow({ where: { authenticationMethod: AuthProvider.ACTIVE_DIRECTORY }, orderBy: { timestamp: 'desc' } });

  it.each([
    ['ad.fofana', ['EMPLOYEE']],
    ['ad.sylla', ['ACCOUNTANT', 'EMPLOYEE']],
    ['ad.kourouma', ['IT_TECHNICIAN']],
    ['ad.camara', ['SUPER_ADMIN']],
  ])('connexion réussie de %s, rôles issus des groupes : %j', async (username, roles) => {
    const response = await loginAd(username);
    expect(response.status).toBe(200);
    expect(response.body.roles.map((r: { name: string }) => r.name).sort()).toEqual(roles);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect((await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { username }, include: { employeeIdentity: true } });
    expect(user).toMatchObject({ authProvider: AuthProvider.ACTIVE_DIRECTORY, passwordHash: null });
    // entryUUID du LDAP de test stocké comme GUID
    expect(user.employeeIdentity?.adObjectGuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect((await lastEvent()).eventType).toBe(AuthEventType.LOGIN_SUCCESS);
  });

  it('deuxième connexion par GUID : la fiche n’est plus retrouvée par e-mail mais par GUID', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { username: 'ad.fofana' }, include: { employeeIdentity: true } });
    await prisma.employee.update({
      where: { id: before.employeeIdentity!.employeeId },
      data: { professionalEmail: 'aminata.fofana@guineasf.com' },
    });
    const response = await loginAd('ad.fofana');
    expect(response.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { username: 'ad.fofana' }, include: { employeeIdentity: true } });
    expect(after.id).toBe(before.id);
    expect(after.employeeIdentity?.adObjectGuid).toBe(before.employeeIdentity?.adObjectGuid);
  });

  it.each<[string, string, AuthEventType]>([
    ['ad.sansfiche', PASSWORD, AuthEventType.AD_NO_EMPLOYEE_MATCH],
    ['ad.sansgroupe', PASSWORD, AuthEventType.AD_NO_ROLE_MAPPING],
    ['ad.conflit', PASSWORD, AuthEventType.AD_LOCAL_ACCOUNT_CONFLICT],
    ['ad.fofana', 'mauvais', AuthEventType.AD_BIND_FAILED],
    ['ad.inexistant', PASSWORD, AuthEventType.AD_USER_NOT_FOUND],
  ])('refus de %s → 401 générique, %s', async (username, password, eventType) => {
    const response = await loginAd(username, password);
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Identifiants invalides.');
    expect((await lastEvent()).eventType).toBe(eventType);
  });

  it('« État des services » : LDAP disponible', async () => {
    const admin = await sessionCookie(app, CREDENTIALS.admin);
    const dashboard = await request(app.getHttpServer()).get('/api/v1/dashboard').set('Cookie', admin);
    expect(dashboard.body.services).toEqual({ database: 'UP', ldap: 'UP' });
  });

  it('conteneur arrêté → 503, AD_UNREACHABLE, SecurityEvent ad_unreachable HIGH, aucun repli local ; LDAP indisponible', async () => {
    docker('stop', '-t', '2', CONTAINER);
    try {
      const start = Date.now();
      const response = await loginAd('ad.sylla');
      expect(response.status).toBe(503);
      expect(response.body.message).toBe(AD_UNAVAILABLE_MESSAGE);
      expect(Date.now() - start).toBeLessThan(5000);
      expect((await lastEvent()).eventType).toBe(AuthEventType.AD_UNREACHABLE);
      const event = await prisma.securityEvent.findFirstOrThrow({ where: { eventType: 'ad_unreachable' }, orderBy: { timestamp: 'desc' } });
      expect(event.severity).toBe(SecuritySeverity.HIGH);
      // Pas de repli : le mot de passe local d'un compte LOCAL ne passe pas par /auth/login-ad
      expect((await loginAd(CREDENTIALS.employee.username, CREDENTIALS.employee.password)).status).toBe(503);
      // Cache de 30 s dépassé : l'état est réévalué
      expect(await app.get(AdStatusService).status(Date.now() + 31_000)).toBe('DOWN');
    } finally {
      docker('start', CONTAINER);
      for (let i = 0; i < 30; i += 1) {
        if (docker('logs', CONTAINER).includes('slapd starting') && (await loginAd('ad.kourouma')).status === 200) break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    expect((await loginAd('ad.kourouma')).status).toBe(200);
  });
});
