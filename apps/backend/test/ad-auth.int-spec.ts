import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthEventType, AuthProvider, PrismaClient, SecuritySeverity, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AD_UNAVAILABLE_MESSAGE } from '../src/ad-auth/ad-auth.service.js';
import { LdapClientFactory } from '../src/ad-auth/ldap-client.js';
import { FakeLdapFactory, adTestEnv } from './fake-ldap.js';
import { CREDENTIALS, createTestApp, nextIp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 2.7 — flux de connexion AD (R31, M23, design §9.3) avec un annuaire simulé,
 * sans Docker : chaque branche, l'AuthEvent de chaque étape, les défauts sûrs, aucun
 * repli local, le SecurityEvent ad_unreachable. Le critère 2.7 contre le LDAP Docker
 * est couvert par `npm run test:ad`.
 */
const BASE = 'dc=gnpaytrust,dc=local';
const GROUPS = `ou=Informatique,${BASE}`;
const PASSWORD = 'Ad-Secret-Test-42';

describe('Connexion Active Directory (intégration, annuaire simulé)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const ldap = new FakeLdapFactory();
  const savedEnv = { ...process.env };
  let roleIds: Map<string, string>;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    const ca = join(mkdtempSync(join(tmpdir(), 'gfep-ad-')), 'ca.crt');
    writeFileSync(ca, 'CA de test');
    Object.assign(process.env, adTestEnv(ca));
    app = await createTestApp({ overrides: [{ provide: LdapClientFactory, useValue: ldap }] });
    roleIds = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]));
    // Fiches de test sans compte local et mappings
    const cf = await prisma.department.findUniqueOrThrow({ where: { code: 'CF' }, include: { positions: true } });
    for (const [number, first, last] of [
      ['GF-2026-901', 'Aminata', 'Fofana'],
      ['GF-2026-902', 'Mamadi', 'Sylla'],
      ['GF-2026-905', 'Nana', 'Keita'],
      ['GF-2026-906', 'Lansana', 'Camara'],
    ] as const) {
      await prisma.employee.create({
        data: {
          employeeNumber: number,
          firstName: first,
          lastName: last,
          professionalEmail: `ad.${last.toLowerCase()}@guineasf.com`,
          departmentId: cf.id,
          positionId: cf.positions[0].id,
          hireDate: new Date('2025-01-06'),
        },
      });
    }
    for (const [group, role] of [
      ['GFEP-Employes', 'EMPLOYEE'],
      ['GFEP-Comptables', 'ACCOUNTANT'],
      ['GFEP-SuperAdmins', 'SUPER_ADMIN'],
    ]) {
      await prisma.adGroupRoleMapping.create({ data: { adGroupDn: `cn=${group},${GROUPS}`, roleId: roleIds.get(role)! } });
    }
    const user = (uid: string, mail: string, guid: string, groups: string[]) =>
      ldap.add({ uid, dn: `uid=${uid},ou=Comptabilite,${BASE}`, password: PASSWORD, mail, guid, groups: groups.map((g) => `cn=${g},${GROUPS}`) });
    user('ad.fofana', 'ad.fofana@guineasf.com', '11111111-1111-4111-8111-111111111111', ['GFEP-Employes']);
    user('ad.sylla', 'AD.Sylla@guineasf.com', '22222222-2222-4222-8222-222222222222', ['GFEP-Employes', 'GFEP-Comptables']);
    user('ad.keita', 'ad.keita@guineasf.com', '33333333-3333-4333-8333-333333333333', ['GFEP-NonMappe']);
    user('ad.sansfiche', 'ad.sansfiche@guineasf.com', '44444444-4444-4444-8444-444444444444', ['GFEP-Employes']);
    user('ad.conflit', 'm.diallo@guineasf.com', '55555555-5555-4555-8555-555555555555', ['GFEP-Employes']);
    user('ad.camara', 'ad.camara@guineasf.com', '66666666-6666-4666-8666-666666666666', ['GFEP-SuperAdmins']);
  });

  afterEach(() => {
    ldap.mode = 'ok';
  });

  afterAll(async () => {
    process.env = savedEnv;
    await app.close();
    await prisma.$disconnect();
  });

  const loginAd = (username: string, password = PASSWORD, ip = nextIp()) =>
    request(app.getHttpServer()).post('/api/v1/auth/login-ad').set('X-Forwarded-For', ip).send({ username, password });
  const lastEvent = () =>
    prisma.authEvent.findFirstOrThrow({ where: { authenticationMethod: AuthProvider.ACTIVE_DIRECTORY }, orderBy: { timestamp: 'desc' } });
  const userOf = (username: string) =>
    prisma.user.findUnique({ where: { username }, include: { userRoles: { include: { role: true } }, employeeIdentity: true } });

  describe('connexion réussie et mapping groupe → rôle', () => {
    it('crée un compte ACTIVE_DIRECTORY sans mot de passe, rattache la fiche par e-mail, stocke le GUID, session identique au flux local', async () => {
      const opened = ldap.opened;
      const response = await loginAd('ad.sylla');
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ username: 'ad.sylla', email: 'ad.sylla@guineasf.com' });
      expect(response.body.roles.map((r: { name: string }) => r.name).sort()).toEqual(['ACCOUNTANT', 'EMPLOYEE']);
      const cookie = (response.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(/^gfep_session=.+HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie.split(';')[0]);
      expect(me.status).toBe(200);

      const user = await userOf('ad.sylla');
      expect(user).toMatchObject({ authProvider: AuthProvider.ACTIVE_DIRECTORY, passwordHash: null, status: UserStatus.ACTIVE });
      expect(user!.employeeIdentity).toMatchObject({
        adObjectGuid: '22222222-2222-4222-8222-222222222222',
        adUsername: 'ad.sylla',
        adSid: null,
      });
      const employee = await prisma.employee.findUniqueOrThrow({ where: { id: user!.employeeIdentity!.employeeId } });
      expect(employee.employeeNumber).toBe('GF-2026-902');
      expect(user!.userRoles.every((r) => r.assignedBy === 'ad-sync')).toBe(true);
      expect(await lastEvent()).toMatchObject({ eventType: AuthEventType.LOGIN_SUCCESS, userId: user!.id });
      // Connexion LDAP ouverte une fois et toujours fermée
      expect(ldap.opened - opened).toBe(1);
      expect(ldap.closed).toBe(ldap.opened);
    });

    it('connexion suivante par GUID, même si l’e-mail de la fiche a changé ; rôles resynchronisés depuis les groupes', async () => {
      const before = await userOf('ad.sylla');
      await prisma.employee.update({ where: { employeeNumber: 'GF-2026-902' }, data: { professionalEmail: 'mamadi.sylla@guineasf.com' } });
      ldap.users.get('ad.sylla')!.groups = [`cn=GFEP-Employes,${GROUPS}`];
      const response = await loginAd('ad.sylla');
      expect(response.status).toBe(200);
      const after = await userOf('ad.sylla');
      expect(after!.id).toBe(before!.id);
      expect(after!.userRoles.map((r) => r.role.name)).toEqual(['EMPLOYEE']);
    });

    it('un groupe mappé vers SUPER_ADMIN donne le rôle SUPER_ADMIN', async () => {
      const response = await loginAd('ad.camara');
      expect(response.status).toBe(200);
      expect(response.body.roles.map((r: { name: string }) => r.name)).toEqual(['SUPER_ADMIN']);
    });
  });

  describe('défauts sûrs : refus 401 générique et AuthEvent de l’étape (M23)', () => {
    it.each<[string, string, string, AuthEventType]>([
      ['aucune fiche Employee', 'ad.sansfiche', PASSWORD, AuthEventType.AD_NO_EMPLOYEE_MATCH],
      ['aucun groupe mappé', 'ad.keita', PASSWORD, AuthEventType.AD_NO_ROLE_MAPPING],
      ['fiche liée à un compte LOCAL (jamais de fusion)', 'ad.conflit', PASSWORD, AuthEventType.AD_LOCAL_ACCOUNT_CONFLICT],
      ['utilisateur introuvable', 'ad.inconnu', PASSWORD, AuthEventType.AD_USER_NOT_FOUND],
      ['mauvais mot de passe', 'ad.fofana', 'mauvais', AuthEventType.AD_BIND_FAILED],
    ])('%s → 401 générique, %s', async (_label, username, password, eventType) => {
      const usersBefore = await prisma.user.count();
      const response = await loginAd(username, password);
      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Identifiants invalides.');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect((await lastEvent()).eventType).toBe(eventType);
      expect(await prisma.user.count()).toBe(usersBefore);
    });

    it('le compte LOCAL en conflit reste intact (aucune fusion)', async () => {
      const local = await prisma.user.findUniqueOrThrow({ where: { username: 'm.diallo' } });
      expect(local.authProvider).toBe(AuthProvider.LOCAL);
      expect(local.passwordHash).not.toBeNull();
    });

    it('compte AD suspendu : refus 401', async () => {
      await loginAd('ad.fofana');
      await prisma.user.update({ where: { username: 'ad.fofana' }, data: { status: UserStatus.SUSPENDED } });
      expect((await loginAd('ad.fofana')).status).toBe(401);
      expect((await lastEvent()).eventType).toBe(AuthEventType.LOGIN_FAILED);
      await prisma.user.update({ where: { username: 'ad.fofana' }, data: { status: UserStatus.ACTIVE } });
    });
  });

  describe('annuaire injoignable : 503, ad_unreachable HIGH, jamais de repli local', () => {
    it('LDAP injoignable → 503 (message AppFlow §3.2), AuthEvent AD_UNREACHABLE, SecurityEvent ad_unreachable HIGH', async () => {
      ldap.mode = 'unreachable';
      const before = await prisma.securityEvent.count({ where: { eventType: 'ad_unreachable' } });
      const response = await loginAd('ad.fofana');
      expect(response.status).toBe(503);
      expect(response.body.message).toBe(AD_UNAVAILABLE_MESSAGE);
      expect((await lastEvent()).eventType).toBe(AuthEventType.AD_UNREACHABLE);
      const events = await prisma.securityEvent.findMany({ where: { eventType: 'ad_unreachable' }, orderBy: { timestamp: 'desc' } });
      expect(events).toHaveLength(before + 1);
      expect(events[0]).toMatchObject({ severity: SecuritySeverity.HIGH, source: 'ad-auth' });
      expect(ldap.closed).toBe(ldap.opened);
    });

    it('aucun repli local : un compte LOCAL et son vrai mot de passe sont refusés par /auth/login-ad', async () => {
      ldap.mode = 'unreachable';
      expect((await loginAd(CREDENTIALS.employee.username, CREDENTIALS.employee.password)).status).toBe(503);
      ldap.mode = 'ok';
      expect((await loginAd(CREDENTIALS.employee.username, CREDENTIALS.employee.password)).status).toBe(401);
    });

    it('compte de service refusé → 503, AuthEvent AD_SERVICE_BIND_FAILED', async () => {
      ldap.mode = 'service-refused';
      const response = await loginAd('ad.fofana');
      expect(response.status).toBe(503);
      expect((await lastEvent()).eventType).toBe(AuthEventType.AD_SERVICE_BIND_FAILED);
    });

    it('configuration incomplète → AD indisponible (503, AD_UNREACHABLE)', async () => {
      const url = process.env.AD_LDAP_URL;
      process.env.AD_LDAP_URL = '';
      const response = await loginAd('ad.fofana');
      process.env.AD_LDAP_URL = url;
      expect(response.status).toBe(503);
      expect((await lastEvent()).eventType).toBe(AuthEventType.AD_UNREACHABLE);
    });
  });

  describe('sécurité du flux', () => {
    it('identifiant injectant un filtre LDAP refusé par le DTO ; mot de passe vide refusé (pas de bind anonyme)', async () => {
      const filtersBefore = ldap.filters.length;
      expect((await loginAd('*)(uid=*')).status).toBe(400);
      expect((await loginAd('ad.fofana', '')).status).toBe(400);
      expect(ldap.filters.length).toBe(filtersBefore);
      // Tous les filtres envoyés à l'annuaire sont bien formés : aucun identifiant n'a pu les altérer
      for (const filter of ldap.filters) expect(filter).toMatch(/^\(&\(objectClass=person\)\(uid=[A-Za-z0-9._-]+\)\)$/);
    });

    it('le mot de passe AD n’est jamais stocké ni journalisé', async () => {
      const stored = JSON.stringify([
        await prisma.user.findMany({ where: { authProvider: AuthProvider.ACTIVE_DIRECTORY } }),
        await prisma.authEvent.findMany(),
        await prisma.securityEvent.findMany(),
        await prisma.auditLog.findMany(),
        await prisma.notification.findMany(),
      ]);
      expect(stored).not.toContain(PASSWORD);
      expect(stored).not.toContain('Svc-Test');
    });

    it('les rôles d’un compte AD ne sont pas modifiables via /access/users (409), ni proposés à l’interface', async () => {
      const admin = await sessionCookie(app, CREDENTIALS.admin);
      const adUser = await prisma.user.findUniqueOrThrow({ where: { username: 'ad.fofana' } });
      const response = await request(app.getHttpServer())
        .put(`/api/v1/access/users/${adUser.id}/roles`)
        .set('Cookie', admin)
        .send({ roleIds: [roleIds.get('SUPER_ADMIN')] });
      expect(response.status).toBe(409);
      expect(response.body.message).toBe("Les rôles de ce compte sont gérés par l'annuaire d'entreprise.");
      const list = await request(app.getHttpServer()).get('/api/v1/access/users?authProvider=ACTIVE_DIRECTORY&limit=100').set('Cookie', admin);
      const row = list.body.data.find((u: { username: string }) => u.username === 'ad.fofana');
      expect(row).toMatchObject({ authProvider: 'ACTIVE_DIRECTORY', capabilities: { canAssignRoles: false } });
    });

    it('rate limiting dédié : 5 tentatives / 15 min / IP sur /auth/login-ad', async () => {
      const ip = nextIp();
      for (let i = 0; i < 5; i += 1) await loginAd('ad.fofana', 'mauvais', ip);
      expect((await loginAd('ad.fofana', PASSWORD, ip)).status).toBe(429);
    });
  });
});
