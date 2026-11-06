import { ForbiddenException, type LoggerService } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AuthEventType, NotificationType, PrismaClient, SecuritySeverity } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { LOCK_DURATION_MS } from '../src/auth/auth.service.js';
import { CREDENTIALS, createTestApp, nextIp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 2.6 — administration et audit (R26–R29, M12, M20, M21). Journaux immuables,
 * lecture réservée au SUPER_ADMIN et à l'AUDITOR, événements de sécurité, aucun secret.
 */
type RoleKey = keyof typeof CREDENTIALS;
const ROLE_KEYS = Object.keys(CREDENTIALS) as RoleKey[];
const AUDIT_ALLOWED: RoleKey[] = ['admin', 'auditor'];
// Aucun secret dans les valeurs auditées, les événements ni les logs
const SECRET_PATTERN = /password|passwordHash|sessionToken|token|\$argon2|GF_[A-Za-z]+2026!/i;

describe('Administration et audit (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: Record<RoleKey, string>;
  const userIds = new Map<string, string>();

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = {} as Record<RoleKey, string>;
    for (const key of ROLE_KEYS) sessions[key] = await sessionCookie(app, CREDENTIALS[key]);
    for (const user of await prisma.user.findMany({ select: { id: true, username: true } })) userIds.set(user.username, user.id);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const server = () => request(app.getHttpServer());
  const as = (key: RoleKey) => ({
    get: (path: string) => server().get(`/api/v1${path}`).set('Cookie', sessions[key]),
    post: (path: string, body: object = {}) => server().post(`/api/v1${path}`).set('Cookie', sessions[key]).send(body),
    put: (path: string, body: object = {}) => server().put(`/api/v1${path}`).set('Cookie', sessions[key]).send(body),
    patch: (path: string, body: object = {}) => server().patch(`/api/v1${path}`).set('Cookie', sessions[key]).send(body),
    delete: (path: string) => server().delete(`/api/v1${path}`).set('Cookie', sessions[key]),
  });
  const failLogins = async (username: string, times = 5) => {
    const ip = nextIp();
    for (let i = 0; i < times; i += 1) {
      await server().post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ username, password: 'mauvais' });
    }
  };
  const ageLock = (username: string) =>
    prisma.authEvent.updateMany({
      where: { userId: userIds.get(username), eventType: AuthEventType.ACCOUNT_LOCKED },
      data: { timestamp: new Date(Date.now() - LOCK_DURATION_MS - 60_000) },
    });

  describe('matrice des rôles (R28.3, M21 : ITA → 403)', () => {
    it.each(ROLE_KEYS)('%s : journaux et historique de consultation', async (key) => {
      const expected = AUDIT_ALLOWED.includes(key) ? 200 : 403;
      const document = await prisma.document.findFirstOrThrow({ where: { confidentialityLevel: 'PUBLIC' } });
      expect((await as(key).get('/audit/logs')).status).toBe(expected);
      expect((await as(key).get('/audit/security-events')).status).toBe(expected);
      expect((await as(key).get('/audit/auth-events')).status).toBe(expected);
      expect((await as(key).get(`/documents/${document.id}/history`)).status).toBe(expected);
    });
  });

  describe('critère 2.6 : une action de chaque type de R26.1 produit une entrée d’audit, sans secret', () => {
    const expectedActions = [
      'employee.create',
      'employee.update',
      'employee.status_change',
      'role.assign',
      'role.remove',
      'user.suspend',
      'user.reactivate',
      'user.unlock',
      'role.permissions_update',
      'document.view',
      'document.download',
      'document.delete',
      'document.validate',
      'document.share',
      'transaction.create',
      'transaction.status_change',
      'invoice.status_change',
    ];

    it('chaque action réalisée via l’API est journalisée, consultable par l’AUDITOR, sans champ secret', async () => {
      // Employés (HR_MANAGER)
      const department = await prisma.department.findUniqueOrThrow({ where: { code: 'CO' }, include: { positions: true } });
      const created = await as('hr').post('/employees', {
        firstName: 'Audit',
        lastName: 'Témoin',
        professionalEmail: 'audit.temoin@guineasf.com',
        departmentId: department.id,
        positionId: department.positions[0].id,
        hireDate: '2026-11-03',
      });
      expect(created.status).toBe(201);
      expect((await as('hr').patch(`/employees/${created.body.id}`, { phone: '+224620001122' })).status).toBe(200);
      expect((await as('hr').patch(`/employees/${created.body.id}/status`, { status: 'SUSPENDED' })).status).toBe(200);

      // Comptes et rôles (IT_ADMINISTRATOR, SUPER_ADMIN)
      const target = userIds.get('k.haba')!;
      const roles = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]));
      expect((await as('itAdmin').put(`/access/users/${target}/roles`, { roleIds: [roles.get('EMPLOYEE'), roles.get('AUDITOR')] })).status).toBe(200);
      expect((await as('itAdmin').put(`/access/users/${target}/roles`, { roleIds: [roles.get('EMPLOYEE')] })).status).toBe(200);
      expect((await as('itAdmin').patch(`/access/users/${target}/status`, { status: 'SUSPENDED' })).status).toBe(200);
      expect((await as('itAdmin').patch(`/access/users/${target}/status`, { status: 'ACTIVE' })).status).toBe(200);
      await failLogins('k.haba');
      expect((await as('itAdmin').post(`/access/users/${target}/unlock`)).status).toBe(200);
      const auditor = await prisma.role.findUniqueOrThrow({ where: { name: 'AUDITOR' }, include: { rolePermissions: true } });
      const current = auditor.rolePermissions.map((p) => p.permissionId);
      const extra = await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource: 'invoices', action: 'read' } } });
      expect((await as('admin').put(`/access/roles/${auditor.id}/permissions`, { permissionIds: [...current, extra.id] })).status).toBe(200);
      expect((await as('admin').put(`/access/roles/${auditor.id}/permissions`, { permissionIds: current })).status).toBe(200);

      // Documents (SUPER_ADMIN)
      const confidential = await prisma.document.findFirstOrThrow({ where: { confidentialityLevel: 'CONFIDENTIAL' } });
      expect((await as('admin').get(`/documents/${confidential.id}`)).status).toBe(200);
      expect((await as('admin').get(`/documents/${confidential.id}/download`)).status).toBe(200);
      // Document en attente dont le SUPER_ADMIN n'est pas propriétaire (on ne valide pas son propre document)
      const pending = await prisma.document.findFirstOrThrow({
        where: { validationStatus: 'PENDING', owner: { is: { identity: { isNot: { userId: userIds.get(CREDENTIALS.admin.username) } } } } },
      });
      expect((await as('admin').patch(`/documents/${pending.id}/validation`, { status: 'VALIDATED' })).status).toBe(200);
      expect((await as('admin').post(`/documents/${pending.id}/permissions`, { userId: userIds.get('m.diallo'), permission: 'READ' })).status).toBe(201);
      const deletable = await prisma.document.findFirstOrThrow({ where: { id: { notIn: [confidential.id, pending.id] } } });
      expect((await as('admin').delete(`/documents/${deletable.id}`)).status).toBe(204);

      // Finance (ACCOUNTANT, SUPER_ADMIN)
      const transaction = await as('accountant').post('/transactions', { transactionType: 'EXPENSE', amount: '25000.00', departmentId: department.id });
      expect(transaction.status).toBe(201);
      expect((await as('admin').patch(`/transactions/${transaction.body.id}/status`, { status: 'VALIDATED' })).status).toBe(200);
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { status: 'SENT' } });
      expect((await as('accountant').patch(`/invoices/${invoice.id}/status`, { status: 'PAID' })).status).toBe(200);

      for (const action of expectedActions) {
        const logs = await prisma.auditLog.findMany({ where: { action } });
        expect(logs.length, action).toBeGreaterThan(0);
        for (const log of logs) {
          expect(JSON.stringify([log.oldValues, log.newValues]), action).not.toMatch(SECRET_PATTERN);
          expect(log.sourceIp, action).not.toBe('');
        }
        // Visibles par l'AUDITOR via l'API de /admin/audit
        const listed = await as('auditor').get(`/audit/logs?action=${action}`);
        expect(listed.body.total, action).toBe(logs.length);
        expect(listed.body.data[0]).toMatchObject({ action, actor: { username: expect.any(String) } });
      }
    });
  });

  describe('filtres et pagination (R28.1)', () => {
    it('journal : famille d’actions, auteur, type de ressource, période, pagination', async () => {
      const family = await as('auditor').get('/audit/logs?action=document.&limit=100');
      expect(family.body.data.every((l: { action: string }) => l.action.startsWith('document.'))).toBe(true);
      expect(family.body.total).toBe(await prisma.auditLog.count({ where: { action: { startsWith: 'document.' } } }));
      const byActor = await as('auditor').get(`/audit/logs?actor=${CREDENTIALS.hr.username}&limit=100`);
      expect(byActor.body.data.every((l: { actor: { username: string } }) => l.actor.username === CREDENTIALS.hr.username)).toBe(true);
      expect(byActor.body.total).toBeGreaterThan(0);
      const byType = await as('admin').get('/audit/logs?resourceType=Transaction');
      expect(byType.body.total).toBe(await prisma.auditLog.count({ where: { resourceType: 'Transaction' } }));
      const today = new Date().toISOString().slice(0, 10);
      expect((await as('admin').get(`/audit/logs?from=${today}&to=${today}`)).body.total).toBe(await prisma.auditLog.count());
      expect((await as('admin').get('/audit/logs?to=2000-01-01')).body.total).toBe(0);
      const page = await as('admin').get('/audit/logs?page=2&limit=5');
      expect(page.body).toMatchObject({ page: 2, limit: 5 });
      expect((await as('admin').get('/audit/logs?limit=101')).status).toBe(400);
      expect((await as('admin').get('/audit/logs?from=03-11-2026')).status).toBe(400);
    });

    it('authentifications : type et utilisateur ; événements de sécurité : sévérité', async () => {
      const failed = await as('auditor').get('/audit/auth-events?eventType=LOGIN_FAILED&limit=100');
      expect(failed.body.total).toBe(await prisma.authEvent.count({ where: { eventType: 'LOGIN_FAILED' } }));
      const byUser = await as('auditor').get('/audit/auth-events?user=k.haba&limit=100');
      expect(byUser.body.data.every((e: { user: { username: string } }) => e.user.username === 'k.haba')).toBe(true);
      expect((await as('auditor').get('/audit/auth-events?eventType=UNKNOWN')).status).toBe(400);
      const medium = await as('auditor').get('/audit/security-events?severity=MEDIUM');
      expect(medium.body.total).toBe(await prisma.securityEvent.count({ where: { severity: 'MEDIUM' } }));
    });
  });

  describe('événements de sécurité (R27, M17, M20)', () => {
    it('account_locked : MEDIUM pour un compte ordinaire, avec alerte WARNING aux ITA', async () => {
      const before = await prisma.securityEvent.count({ where: { eventType: 'account_locked' } });
      await failLogins('l.sacko');
      const events = await prisma.securityEvent.findMany({ where: { eventType: 'account_locked' }, orderBy: { timestamp: 'asc' } });
      expect(events).toHaveLength(before + 1);
      expect(events.at(-1)).toMatchObject({ severity: SecuritySeverity.MEDIUM, source: 'auth' });
      expect(events.at(-1)!.metadata).toMatchObject({ username: 'l.sacko', lastActiveSuperAdmin: false });
      expect(JSON.stringify(events.at(-1))).not.toMatch(SECRET_PATTERN);
      const warning = await prisma.notification.findFirst({
        where: { userId: userIds.get(CREDENTIALS.itAdmin.username), type: NotificationType.WARNING, message: { contains: '« l.sacko »' } },
      });
      expect(warning).not.toBeNull();
    });

    it('account_locked : HIGH pour le dernier SUPER_ADMIN actif, MEDIUM s’il reste un autre SA actif ; WARNING aux ITA chaque fois', async () => {
      await failLogins(CREDENTIALS.admin.username);
      const last = await prisma.securityEvent.findFirstOrThrow({ where: { eventType: 'account_locked' }, orderBy: { timestamp: 'desc' } });
      expect(last).toMatchObject({ severity: SecuritySeverity.HIGH });
      expect(last.metadata).toMatchObject({ username: CREDENTIALS.admin.username, lastActiveSuperAdmin: true });
      await ageLock(CREDENTIALS.admin.username);
      sessions.admin = await sessionCookie(app, CREDENTIALS.admin);

      // Second SA actif : le verrouillage de t.balde n'est plus celui du dernier SA actif
      const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
      expect((await as('admin').put(`/access/users/${userIds.get('k.bangoura')}/roles`, { roleIds: [superAdminRole.id] })).status).toBe(200);
      await failLogins(CREDENTIALS.admin.username);
      const second = await prisma.securityEvent.findFirstOrThrow({ where: { eventType: 'account_locked' }, orderBy: { timestamp: 'desc' } });
      expect(second).toMatchObject({ severity: SecuritySeverity.MEDIUM });
      const warnings = await prisma.notification.count({
        where: { userId: userIds.get(CREDENTIALS.itAdmin.username), type: NotificationType.WARNING, message: { contains: `« ${CREDENTIALS.admin.username} »` } },
      });
      expect(warnings).toBe(2);
      await ageLock(CREDENTIALS.admin.username);
      sessions.admin = await sessionCookie(app, CREDENTIALS.admin);
    });

    it('repeated_forbidden : au 5e refus 403 en 5 minutes, un seul événement par fenêtre (horloge simulée)', async () => {
      const username = 'f.kante';
      const cookie = await sessionCookie(app, { username, password: 'GF_Emp2026!' });
      const forbidden = () => server().get('/api/v1/audit/logs').set('Cookie', cookie);
      const count = () => prisma.securityEvent.count({ where: { eventType: 'repeated_forbidden', metadata: { path: ['username'], equals: username } } });
      vi.useFakeTimers({ toFake: ['Date'] });
      const start = new Date();
      vi.setSystemTime(start);

      for (let i = 0; i < 4; i += 1) expect((await forbidden()).status).toBe(403);
      expect(await count()).toBe(0);
      const fifth = await forbidden();
      // Le 403 renvoyé reste le 403 standard
      expect(fifth.status).toBe(403);
      expect(fifth.body).toEqual(new ForbiddenException().getResponse());
      expect(await count()).toBe(1);
      for (let i = 0; i < 5; i += 1) await forbidden();
      expect(await count()).toBe(1);

      // Fenêtre écoulée : 5 nouveaux refus produisent un second événement
      vi.setSystemTime(new Date(start.getTime() + 5 * 60 * 1000 + 1000));
      for (let i = 0; i < 4; i += 1) await forbidden();
      expect(await count()).toBe(1);
      await forbidden();
      expect(await count()).toBe(2);
      const event = await prisma.securityEvent.findFirstOrThrow({ where: { eventType: 'repeated_forbidden' } });
      expect(event).toMatchObject({ severity: SecuritySeverity.MEDIUM, source: 'rbac' });
      expect(event.metadata).toMatchObject({ username, refusals: 5, lastPath: '/api/v1/audit/logs' });
    });
  });

  describe('historique de consultation (R28.4, M24)', () => {
    it('SA et AUD : audits document.* du document ; document invisible → 404', async () => {
      const confidential = await prisma.document.findFirstOrThrow({ where: { confidentialityLevel: 'CONFIDENTIAL' } });
      const history = await as('admin').get(`/documents/${confidential.id}/history`);
      expect(history.status).toBe(200);
      expect(history.body.map((h: { action: string }) => h.action)).toEqual(expect.arrayContaining(['document.view', 'document.download']));
      expect(history.body[0]).toEqual({
        id: expect.any(String),
        action: expect.stringMatching(/^document\./),
        actor: { id: expect.any(String), username: expect.any(String) },
        sourceIp: expect.any(String),
        timestamp: expect.any(String),
      });
      // L'AUDITOR suit la visibilité M9 : un document confidentiel non partagé reste introuvable
      expect((await as('auditor').get(`/documents/${confidential.id}/history`)).status).toBe(404);
      expect((await as('admin').get('/documents/00000000-0000-4000-8000-000000000000/history')).status).toBe(404);
    });
  });

  describe('immutabilité du journal (R26.2, M12)', () => {
    it('aucune route d’écriture ne modifie ni ne supprime un AuditLog ; seules des routes GET sous /audit', async () => {
      const instance = app.getHttpAdapter().getInstance();
      const stack = (instance.router ?? instance._router).stack as Array<{ route?: { path: string; methods: Record<string, boolean> } }>;
      const routes = stack
        .filter((layer) => layer.route)
        .flatMap(({ route }) => Object.keys(route!.methods).map((method) => ({ method: method.toUpperCase(), path: route!.path })));
      expect(routes.filter((r) => r.path.startsWith('/api/v1/audit')).map((r) => r.method)).toEqual(['GET', 'GET', 'GET']);
      const writes = routes.filter((r) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method));
      expect(writes.length).toBeGreaterThan(15);

      const snapshot = await prisma.auditLog.findMany({ orderBy: { id: 'asc' } });
      expect(snapshot.length).toBeGreaterThan(10);
      const target = snapshot[0].id;
      // Chaque route d'écriture, paramètres remplacés par l'identifiant d'un AuditLog existant ;
      // la déconnexion en dernier pour garder la session
      const ordered = [...writes].sort((a, b) => Number(a.path.endsWith('/logout')) - Number(b.path.endsWith('/logout')));
      for (const { method, path } of ordered) {
        const url = path.replace(/:[A-Za-z]+/g, target);
        const call = server()[method.toLowerCase() as 'post' | 'put' | 'patch' | 'delete'](url).set('Cookie', sessions.admin);
        const response = await call.send({});
        expect(response.status, `${method} ${path}`).not.toBe(500);
      }
      // Tentatives directes sur un AuditLog existant : aucune route
      const direct = [
        await server().patch(`/api/v1/audit/logs/${target}`).set('Cookie', sessions.auditor).send({ action: 'falsifié' }),
        await server().put(`/api/v1/audit/logs/${target}`).set('Cookie', sessions.auditor).send({ action: 'falsifié' }),
        await server().delete(`/api/v1/audit/logs/${target}`).set('Cookie', sessions.auditor),
        await server().post('/api/v1/audit/logs').set('Cookie', sessions.auditor).send({ action: 'forgé' }),
      ];
      expect(direct.map((r) => r.status)).toEqual([404, 404, 404, 404]);

      const after = await prisma.auditLog.findMany({ where: { id: { in: snapshot.map((l) => l.id) } }, orderBy: { id: 'asc' } });
      expect(after).toEqual(snapshot);
    });
  });
});

describe('Aucune donnée sensible dans les logs ni dans l’audit (R26.3)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const captured: string[] = [];
  const capture = (...args: unknown[]) => captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  const logger: LoggerService = { log: capture, error: capture, warn: capture, debug: capture, verbose: capture, fatal: capture };

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // Logger actif et capturé (les autres suites désactivent les logs)
    app = configureApp(moduleRef.createNestApplication<NestExpressApplication>({ logger }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('connexion : ni le mot de passe saisi, ni le jeton de session, ni un hash n’apparaissent dans les logs, la base ou la réponse', async () => {
    const secret = 'Secret-Saisi-7Q2!';
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => capture(...args)),
    );
    const login = (body: unknown, ip = nextIp()) =>
      request(app.getHttpServer()).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send(body as object);

    // Échecs (dont verrouillage), champ inconnu, JSON mal formé, puis succès
    for (let i = 0; i < 5; i += 1) expect((await login({ username: 'm.diallo', password: secret })).status).toBe(401);
    expect((await login({ username: 'inconnu', password: secret })).status).toBe(401);
    const extra = await login({ username: 'k.haba', password: secret, passwordConfirm: secret });
    expect(extra.status).toBe(400);
    expect(JSON.stringify(extra.body)).not.toContain(secret);
    const malformed = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"username":"k.haba","password":"${secret}"`);
    expect(malformed.status).toBe(400);
    expect(JSON.stringify(malformed.body)).not.toContain(secret);
    // m.diallo vient d'être verrouillé : connexion réussie avec un autre compte
    const success = await login({ username: 'k.haba', password: 'GF_Emp2026!' });
    expect(success.status).toBe(200);
    const token = (success.headers['set-cookie'] as unknown as string[])[0].split(';')[0].split('=')[1];
    expect(JSON.stringify(success.body)).not.toMatch(/passwordHash|\$argon2/);
    expect(JSON.stringify(success.body)).not.toContain(token);
    spies.forEach((spy) => spy.mockRestore());

    // Logs capturés
    const logs = captured.join('\n');
    for (const value of [secret, token, 'GF_Emp2026!', '$argon2']) expect(logs).not.toContain(value);

    // Base : journaux, événements, notifications, sessions
    const stored = JSON.stringify([
      await prisma.auditLog.findMany(),
      await prisma.authEvent.findMany(),
      await prisma.securityEvent.findMany(),
      await prisma.notification.findMany(),
    ]);
    for (const value of [secret, token, 'GF_Emp2026!', '$argon2']) expect(stored).not.toContain(value);
    expect(await prisma.session.count({ where: { sessionTokenHash: token } })).toBe(0);
    // Le verrouillage a bien produit des traces, sans secret
    expect(await prisma.securityEvent.count({ where: { eventType: 'account_locked' } })).toBe(1);
  });
});
