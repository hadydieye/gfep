import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthEventType, AuthProvider, PrismaClient, UserStatus } from '@prisma/client';
import request from 'supertest';
import { CREDENTIALS, createTestApp, login, nextIp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 2.4 — module /access (R18, R19, M17, M18). Comptes du seed :
 * SUPER_ADMIN t.balde, IT_ADMINISTRATOR m.keita, et les 6 autres rôles.
 */
type RoleKey = keyof typeof CREDENTIALS;
const ROLE_KEYS = Object.keys(CREDENTIALS) as RoleKey[];
const ACCESS_ALLOWED: RoleKey[] = ['admin', 'itAdmin'];
const AD_MESSAGE = "Les rôles de ce compte sont gérés par l'annuaire d'entreprise.";

describe('Accès : rôles et comptes (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: Record<RoleKey, string>;
  let roleIds: Map<string, string>;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = Object.fromEntries(
      await Promise.all(ROLE_KEYS.map(async (key) => [key, await sessionCookie(app, CREDENTIALS[key])] as const)),
    ) as Record<RoleKey, string>;
    roleIds = new Map((await prisma.role.findMany()).map((role) => [role.name, role.id]));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const url = (path: string) => `/api/v1${path}`;
  const call = (method: 'GET' | 'PUT' | 'PATCH' | 'POST', path: string, cookie?: string, body?: object) => {
    const server = request(app.getHttpServer());
    let req =
      method === 'GET'
        ? server.get(url(path))
        : method === 'PUT'
          ? server.put(url(path))
          : method === 'PATCH'
            ? server.patch(url(path))
            : server.post(url(path));
    if (cookie) req = req.set('Cookie', cookie);
    return body ? req.send(body) : req;
  };
  const userByName = (username: string) =>
    prisma.user.findUniqueOrThrow({ where: { username }, include: { userRoles: { include: { role: true } } } });
  const rolesOf = async (username: string) => (await userByName(username)).userRoles.map(({ role }) => role.name).sort();
  const setRoles = (cookie: string, username: string, names: string[]) =>
    userByName(username).then((user) =>
      call('PUT', `/access/users/${user.id}/roles`, cookie, { roleIds: names.map((name) => roleIds.get(name)!) }),
    );
  const setStatus = (cookie: string, userId: string, status: string) =>
    call('PATCH', `/access/users/${userId}/status`, cookie, { status });
  const lockAccount = async (username: string) => {
    const user = await userByName(username);
    await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.LOCKED, failedLoginCount: 5 } });
    await prisma.authEvent.create({
      data: { userId: user.id, eventType: AuthEventType.ACCOUNT_LOCKED, sourceIp: '10.0.0.1', authenticationMethod: AuthProvider.LOCAL },
    });
    return user;
  };

  describe('matrice des rôles sur /access (R18, R19)', () => {
    it.each(ROLE_KEYS)('%s : lecture des comptes et des rôles', async (key) => {
      const expected = ACCESS_ALLOWED.includes(key) ? 200 : 403;
      expect((await call('GET', '/access/users', sessions[key])).status).toBe(expected);
      expect((await call('GET', '/access/roles', sessions[key])).status).toBe(expected);
      expect((await call('GET', `/access/roles/${roleIds.get('EMPLOYEE')}`, sessions[key])).status).toBe(expected);
    });

    it.each(ROLE_KEYS)('%s : modification de la matrice réservée au SUPER_ADMIN', async (key) => {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: 'AUDITOR' }, include: { rolePermissions: true } });
      const response = await call('PUT', `/access/roles/${role.id}/permissions`, sessions[key], {
        permissionIds: role.rolePermissions.map(({ permissionId }) => permissionId),
      });
      expect(response.status).toBe(key === 'admin' ? 200 : 403);
    });

    it.each(ROLE_KEYS)('%s : écritures sur les comptes réservées au SA et à l’ITA', async (key) => {
      const target = await userByName('k.bangoura');
      const expected = ACCESS_ALLOWED.includes(key) ? 200 : 403;
      // Mêmes rôles : opération sans effet si autorisée
      expect((await setRoles(sessions[key], 'k.bangoura', ['EMPLOYEE'])).status).toBe(expected);
      // Statut identique : 409 si autorisé (aucune écriture), 403 sinon
      expect((await setStatus(sessions[key], target.id, 'ACTIVE')).status).toBe(ACCESS_ALLOWED.includes(key) ? 409 : 403);
      expect((await call('POST', `/access/users/${target.id}/unlock`, sessions[key])).status).toBe(
        ACCESS_ALLOWED.includes(key) ? 409 : 403,
      );
    });

    it('aucune création de compte : POST /access/users n’existe pas', async () => {
      expect((await call('POST', '/access/users', sessions.admin, { username: 'x' })).status).toBe(404);
    });
  });

  describe('liste des comptes (R18.1)', () => {
    it('rôles, statut, méthode, dernière connexion ; jamais de hash ni de secret', async () => {
      const response = await call('GET', '/access/users?limit=100', sessions.itAdmin);
      expect(response.body.total).toBe(40);
      const keita = response.body.data.find((u: { username: string }) => u.username === 'm.keita');
      expect(keita).toMatchObject({
        displayName: 'Mohamed Keïta',
        roles: [{ name: 'IT_ADMINISTRATOR' }],
        status: 'ACTIVE',
        authProvider: 'LOCAL',
        department: { code: 'IT' },
      });
      expect(keita.lastLoginAt).not.toBeNull();
      const body = JSON.stringify(response.body);
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('$argon2');
    });

    it('filtres rôle, statut, méthode, recherche ; pagination', async () => {
      const auditors = await call('GET', `/access/users?roleId=${roleIds.get('AUDITOR')}`, sessions.admin);
      expect(auditors.body.data.map((u: { username: string }) => u.username)).toEqual(['s.toure']);
      expect((await call('GET', '/access/users?search=camara', sessions.admin)).body.data[0].username).toBe('f.camara');
      expect((await call('GET', '/access/users?authProvider=ACTIVE_DIRECTORY', sessions.admin)).body.total).toBe(0);
      expect((await call('GET', '/access/users?status=LOCKED', sessions.admin)).body.total).toBe(
        await prisma.user.count({ where: { status: 'LOCKED' } }),
      );
      const page = await call('GET', '/access/users?page=2&limit=10', sessions.admin);
      expect(page.body).toMatchObject({ page: 2, limit: 10 });
      expect(page.body.data).toHaveLength(10);
      expect((await call('GET', '/access/users?limit=101', sessions.admin)).status).toBe(400);
    });

    it('capacités : actions interdites par M17 non proposées', async () => {
      const list = (await call('GET', '/access/users?limit=100', sessions.itAdmin)).body.data as Array<{
        username: string;
        capabilities: Record<string, boolean>;
      }>;
      const of = (username: string) => list.find((u) => u.username === username)!.capabilities;
      expect(of('t.balde')).toEqual({ canAssignRoles: false, canChangeStatus: false, canUnlock: false });
      expect(of('m.keita')).toEqual({ canAssignRoles: false, canChangeStatus: false, canUnlock: false });
      expect(of('m.diallo')).toMatchObject({ canAssignRoles: true, canChangeStatus: true, canUnlock: false });
    });
  });

  describe('garde-fous de M17 (un test par règle)', () => {
    it('seul un SUPER_ADMIN attribue le rôle SUPER_ADMIN', async () => {
      expect((await setRoles(sessions.itAdmin, 'k.bangoura', ['EMPLOYEE', 'SUPER_ADMIN'])).status).toBe(403);
      expect(await rolesOf('k.bangoura')).toEqual(['EMPLOYEE']);
      expect((await setRoles(sessions.admin, 'k.bangoura', ['EMPLOYEE', 'SUPER_ADMIN'])).status).toBe(200);
      expect(await rolesOf('k.bangoura')).toEqual(['EMPLOYEE', 'SUPER_ADMIN']);
    });

    it('seul un SUPER_ADMIN retire le rôle SUPER_ADMIN (et un ITA n’agit pas sur un SUPER_ADMIN)', async () => {
      expect((await setRoles(sessions.itAdmin, 'k.bangoura', ['EMPLOYEE'])).status).toBe(403);
      expect(await rolesOf('k.bangoura')).toEqual(['EMPLOYEE', 'SUPER_ADMIN']);
      expect((await setRoles(sessions.admin, 'k.bangoura', ['EMPLOYEE'])).status).toBe(200);
      expect(await rolesOf('k.bangoura')).toEqual(['EMPLOYEE']);
    });

    it('personne ne modifie ses propres rôles', async () => {
      expect((await setRoles(sessions.admin, 't.balde', ['SUPER_ADMIN', 'EMPLOYEE'])).status).toBe(403);
      expect((await setRoles(sessions.itAdmin, 'm.keita', ['IT_ADMINISTRATOR', 'HR_MANAGER'])).status).toBe(403);
      expect(await rolesOf('m.keita')).toEqual(['IT_ADMINISTRATOR']);
    });

    it('personne ne suspend, ne réactive ni ne déverrouille son propre compte', async () => {
      const admin = await userByName('t.balde');
      const itAdmin = await userByName('m.keita');
      expect((await setStatus(sessions.admin, admin.id, 'SUSPENDED')).status).toBe(403);
      expect((await setStatus(sessions.itAdmin, itAdmin.id, 'SUSPENDED')).status).toBe(403);
      expect((await call('POST', `/access/users/${itAdmin.id}/unlock`, sessions.itAdmin)).status).toBe(403);
      expect((await userByName('m.keita')).status).toBe(UserStatus.ACTIVE);
    });

    it('un IT_ADMINISTRATOR ne suspend, ne réactive, ne déverrouille ni ne modifie un SUPER_ADMIN', async () => {
      // Second SUPER_ADMIN, pour que la règle « dernier SA actif » ne soit pas en jeu
      expect((await setRoles(sessions.admin, 'k.bangoura', ['SUPER_ADMIN'])).status).toBe(200);
      const target = await userByName('k.bangoura');
      expect((await setStatus(sessions.itAdmin, target.id, 'SUSPENDED')).status).toBe(403);
      expect((await setRoles(sessions.itAdmin, 'k.bangoura', ['SUPER_ADMIN', 'EMPLOYEE'])).status).toBe(403);
      await prisma.user.update({ where: { id: target.id }, data: { status: UserStatus.SUSPENDED } });
      expect((await setStatus(sessions.itAdmin, target.id, 'ACTIVE')).status).toBe(403);
      await lockAccount('k.bangoura');
      expect((await call('POST', `/access/users/${target.id}/unlock`, sessions.itAdmin)).status).toBe(403);
      expect((await userByName('k.bangoura')).status).toBe(UserStatus.LOCKED);
      // Remise en état par le SUPER_ADMIN
      expect((await call('POST', `/access/users/${target.id}/unlock`, sessions.admin)).status).toBe(200);
      expect((await setRoles(sessions.admin, 'k.bangoura', ['EMPLOYEE'])).status).toBe(200);
    });

    it('compte ACTIVE_DIRECTORY : rôles non modifiables via l’interface (409)', async () => {
      const employee = await prisma.employee.findUniqueOrThrow({ where: { employeeNumber: 'GF-2026-040' } });
      await prisma.employeeIdentity.deleteMany({ where: { employeeId: employee.id } });
      const adUser = await prisma.user.create({
        data: { username: 'ad.test', email: 'ad.test@example.test', authProvider: AuthProvider.ACTIVE_DIRECTORY },
      });
      const response = await call('PUT', `/access/users/${adUser.id}/roles`, sessions.admin, {
        roleIds: [roleIds.get('EMPLOYEE')],
      });
      expect(response.status).toBe(409);
      expect(response.body.message).toBe(AD_MESSAGE);
      expect(await prisma.userRole.count({ where: { userId: adUser.id } })).toBe(0);
    });

    it('rôle inexistant ou liste vide : 400', async () => {
      const target = await userByName('k.bangoura');
      const unknown = await call('PUT', `/access/users/${target.id}/roles`, sessions.admin, {
        roleIds: ['00000000-0000-4000-8000-000000000000'],
      });
      expect(unknown.status).toBe(400);
      expect(unknown.body.message).toBe('Rôle inexistant.');
      expect((await call('PUT', `/access/users/${target.id}/roles`, sessions.admin, { roleIds: [] })).status).toBe(400);
    });

    it('attribution et retrait audités, effet immédiat sur les droits', async () => {
      const target = await userByName('m.diallo');
      const employeeSession = sessions.employee;
      expect((await call('GET', '/transactions', employeeSession)).status).toBe(403);
      expect((await setRoles(sessions.itAdmin, 'm.diallo', ['EMPLOYEE', 'ACCOUNTANT'])).status).toBe(200);
      expect((await call('GET', '/transactions', employeeSession)).status).toBe(200);
      expect((await setRoles(sessions.itAdmin, 'm.diallo', ['EMPLOYEE'])).status).toBe(200);
      expect((await call('GET', '/transactions', employeeSession)).status).toBe(403);
      const actions = (
        await prisma.auditLog.findMany({ where: { resourceId: target.id }, orderBy: { timestamp: 'asc' } })
      ).map((log) => [log.action, (log.newValues as { role: string }).role]);
      expect(actions).toEqual([
        ['role.assign', 'ACCOUNTANT'],
        ['role.remove', 'ACCOUNTANT'],
      ]);
    });
  });

  describe('suspension, réactivation et déverrouillage (R18)', () => {
    it('la suspension révoque toutes les sessions ; la réactivation rouvre la connexion', async () => {
      const target = await userByName('a.diakite');
      const cookie = await sessionCookie(app, { username: 'a.diakite', password: 'GF_Emp2026!' });
      expect((await call('GET', '/dashboard', cookie)).status).toBe(200);

      const suspended = await setStatus(sessions.itAdmin, target.id, 'SUSPENDED');
      expect(suspended.status).toBe(200);
      expect(suspended.body.status).toBe('SUSPENDED');
      expect((await call('GET', '/dashboard', cookie)).status).toBe(401);
      expect(await prisma.session.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
      expect((await login(app, { username: 'a.diakite', password: 'GF_Emp2026!' }, nextIp())).status).toBe(401);
      const log = await prisma.auditLog.findFirstOrThrow({ where: { resourceId: target.id, action: 'user.suspend' } });
      expect((log.newValues as { revokedSessions: number }).revokedSessions).toBeGreaterThanOrEqual(1);

      expect((await setStatus(sessions.itAdmin, target.id, 'SUSPENDED')).status).toBe(409);
      expect((await setStatus(sessions.itAdmin, target.id, 'ACTIVE')).status).toBe(200);
      expect((await login(app, { username: 'a.diakite', password: 'GF_Emp2026!' }, nextIp())).status).toBe(200);
      expect(await prisma.auditLog.count({ where: { resourceId: target.id, action: 'user.reactivate' } })).toBe(1);
    });

    it('déverrouillage manuel : LOCKED → ACTIVE, compteur à 0, audit ; 409 si non verrouillé', async () => {
      const target = await lockAccount('l.sacko');
      // Un compte LOCKED ne se réactive pas par le statut : il se déverrouille
      expect((await setStatus(sessions.itAdmin, target.id, 'ACTIVE')).status).toBe(409);
      const response = await call('POST', `/access/users/${target.id}/unlock`, sessions.itAdmin);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ACTIVE');
      expect((await userByName('l.sacko')).failedLoginCount).toBe(0);
      expect((await login(app, { username: 'l.sacko', password: 'GF_Emp2026!' }, nextIp())).status).toBe(200);
      expect(await prisma.auditLog.count({ where: { resourceId: target.id, action: 'user.unlock' } })).toBe(1);
      expect((await call('POST', `/access/users/${target.id}/unlock`, sessions.itAdmin)).status).toBe(409);
    });

    it('statut cible invalide : 400 générique ; compte inexistant : 404', async () => {
      const target = await userByName('k.haba');
      expect((await setStatus(sessions.admin, target.id, 'LOCKED')).status).toBe(400);
      expect((await setStatus(sessions.admin, '00000000-0000-4000-8000-000000000000', 'SUSPENDED')).status).toBe(404);
    });
  });

  describe('matrice rôle ↔ permission (M18, un test par règle)', () => {
    const permissionsOf = async (name: string) =>
      (await prisma.role.findUniqueOrThrow({ where: { name }, include: { rolePermissions: true } })).rolePermissions.map(
        ({ permissionId }) => permissionId,
      );
    const permissionId = async (key: string) => {
      const [resource, action] = key.split(':');
      return (await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource, action } } })).id;
    };

    it('le rôle SUPER_ADMIN n’est pas modifiable', async () => {
      const response = await call('PUT', `/access/roles/${roleIds.get('SUPER_ADMIN')}/permissions`, sessions.admin, {
        permissionIds: await permissionsOf('SUPER_ADMIN'),
      });
      expect(response.status).toBe(403);
      const detail = await call('GET', `/access/roles/${roleIds.get('SUPER_ADMIN')}`, sessions.admin);
      expect(detail.body.editable).toBe(false);
    });

    it('l’IT_ADMINISTRATOR consulte la matrice en lecture seule', async () => {
      const detail = await call('GET', `/access/roles/${roleIds.get('AUDITOR')}`, sessions.itAdmin);
      expect(detail.status).toBe(200);
      expect(detail.body.editable).toBe(false);
      expect(detail.body.catalog).toHaveLength(25);
    });

    it('personne ne retire une permission d’un rôle qu’il détient (ajout possible)', async () => {
      // Un second SUPER_ADMIN qui détient aussi EMPLOYEE
      expect((await setRoles(sessions.admin, 'k.bangoura', ['SUPER_ADMIN', 'EMPLOYEE'])).status).toBe(200);
      const cookie = await sessionCookie(app, { username: 'k.bangoura', password: 'GF_Emp2026!' });
      const current = await permissionsOf('EMPLOYEE');
      const documentsRead = await permissionId('documents:read');
      const removal = await call('PUT', `/access/roles/${roleIds.get('EMPLOYEE')}/permissions`, cookie, {
        permissionIds: current.filter((id) => id !== documentsRead),
      });
      expect(removal.status).toBe(403);
      expect((await permissionsOf('EMPLOYEE')).sort()).toEqual([...current].sort());
      const detail = await call('GET', `/access/roles/${roleIds.get('EMPLOYEE')}`, cookie);
      expect([...detail.body.lockedPermissionIds].sort((a, b) => a.localeCompare(b))).toEqual([...current].sort((a, b) => a.localeCompare(b)));

      const invoicesRead = await permissionId('invoices:read');
      const addition = await call('PUT', `/access/roles/${roleIds.get('EMPLOYEE')}/permissions`, cookie, {
        permissionIds: [...current, invoicesRead],
      });
      expect(addition.status).toBe(200);
      // Remise en état par t.balde, qui ne détient pas EMPLOYEE
      expect(
        (await call('PUT', `/access/roles/${roleIds.get('EMPLOYEE')}/permissions`, sessions.admin, { permissionIds: current })).status,
      ).toBe(200);
      expect((await setRoles(sessions.admin, 'k.bangoura', ['EMPLOYEE'])).status).toBe(200);
    });

    it('modification auditée et effective immédiatement ; permission inconnue → 400', async () => {
      const current = await permissionsOf('AUDITOR');
      const documentsRead = await permissionId('documents:read');
      const reduced = await call('PUT', `/access/roles/${roleIds.get('AUDITOR')}/permissions`, sessions.admin, {
        permissionIds: current.filter((id) => id !== documentsRead),
      });
      expect(reduced.status).toBe(200);
      expect(reduced.body.permissionCount).toBe(current.length - 1);
      expect((await call('GET', '/documents', sessions.auditor)).status).toBe(403);
      const log = await prisma.auditLog.findFirstOrThrow({
        where: { resourceId: roleIds.get('AUDITOR'), action: 'role.permissions_update' },
      });
      expect((log.oldValues as { permissions: string[] }).permissions).toContain('documents:read');
      expect((log.newValues as { permissions: string[] }).permissions).not.toContain('documents:read');

      expect(
        (await call('PUT', `/access/roles/${roleIds.get('AUDITOR')}/permissions`, sessions.admin, { permissionIds: current })).status,
      ).toBe(200);
      expect((await call('GET', '/documents', sessions.auditor)).status).toBe(200);
      const unknown = await call('PUT', `/access/roles/${roleIds.get('AUDITOR')}/permissions`, sessions.admin, {
        permissionIds: [...current, '00000000-0000-4000-8000-000000000000'],
      });
      expect(unknown.status).toBe(400);
      expect(unknown.body.message).toBe('Permission inexistante.');
    });

    it('liste des 8 rôles avec nombre de comptes et de permissions', async () => {
      const response = await call('GET', '/access/roles', sessions.itAdmin);
      expect(response.body.map((r: { name: string }) => r.name)).toEqual([
        'SUPER_ADMIN',
        'IT_ADMINISTRATOR',
        'IT_TECHNICIAN',
        'HR_MANAGER',
        'ACCOUNTANT',
        'DEPARTMENT_MANAGER',
        'EMPLOYEE',
        'AUDITOR',
      ]);
      const superAdmin = response.body.find((r: { name: string }) => r.name === 'SUPER_ADMIN');
      expect(superAdmin).toMatchObject({ userCount: 1, permissionCount: 25 });
    });
  });
});
