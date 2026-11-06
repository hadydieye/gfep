import type { NestExpressApplication } from '@nestjs/platform-express';
import { AuthEventType, NotificationType, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { LOCK_DURATION_MS } from '../src/auth/auth.service.js';
import { CREDENTIALS, createTestApp, nextIp, resetDatabase, seedOrThrow, sessionCookie, sessionTokenFrom, testPrisma } from './helpers.js';

/**
 * Étape 2.5 — notifications (R22–R25, M19, design §7). Une notification n'est
 * visible et modifiable que par son destinataire ; celle d'autrui est traitée
 * comme inexistante (404), sans fuite d'existence.
 */
type RoleKey = keyof typeof CREDENTIALS;
const ROLE_KEYS = Object.keys(CREDENTIALS) as RoleKey[];
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Notifications (intégration)', () => {
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
    for (const user of await prisma.user.findMany({ select: { id: true, username: true } })) {
      userIds.set(user.username, user.id);
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const server = () => request(app.getHttpServer());
  const id = (username: string) => userIds.get(username)!;
  const notificationsOf = (username: string, type?: NotificationType) =>
    prisma.notification.findMany({ where: { userId: id(username), ...(type ? { type } : {}) }, orderBy: { createdAt: 'asc' } });
  const loginWith = (username: string, password: string, ip: string, userAgent: string) =>
    server().post('/api/v1/auth/login').set('X-Forwarded-For', ip).set('User-Agent', userAgent).send({ username, password });
  const createFor = (username: string, title = 'Notification de test') =>
    prisma.notification.create({ data: { userId: id(username), type: NotificationType.INFO, title, message: 'Message de test' } });

  describe('accès des 8 rôles (R22.1)', () => {
    it.each(ROLE_KEYS)('%s : liste, compteur, lecture et « tout lire » autorisés', async (key) => {
      const own = await createFor(CREDENTIALS[key].username);
      const cookie = sessions[key];
      expect((await server().get('/api/v1/notifications').set('Cookie', cookie)).status).toBe(200);
      expect((await server().get('/api/v1/notifications/unread-count').set('Cookie', cookie)).status).toBe(200);
      expect((await server().patch(`/api/v1/notifications/${own.id}/read`).set('Cookie', cookie)).status).toBe(200);
      expect((await server().post('/api/v1/notifications/read-all').set('Cookie', cookie)).status).toBe(200);
    });

    it('sans session : 401 sur chaque route', async () => {
      const responses = await Promise.all([
        server().get('/api/v1/notifications'),
        server().get('/api/v1/notifications/unread-count'),
        server().patch(`/api/v1/notifications/${UNKNOWN_ID}/read`),
        server().post('/api/v1/notifications/read-all'),
      ]);
      expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    });
  });

  describe('isolation par destinataire (R22.2, test IDOR)', () => {
    it('A ne peut ni lire, ni marquer lue, ni supprimer une notification de B ; 404 identique à une notification inexistante', async () => {
      const ofB = await createFor(CREDENTIALS.employee.username, 'Notification privée de B');
      const cookieA = sessions.hr;

      // Lire : absente de la liste de A, compteur de A non affecté
      const list = await server().get('/api/v1/notifications?limit=100').set('Cookie', cookieA);
      expect(list.body.data.map((n: { id: string }) => n.id)).not.toContain(ofB.id);
      expect(JSON.stringify(list.body)).not.toContain('Notification privée de B');
      const countA = await server().get('/api/v1/notifications/unread-count').set('Cookie', cookieA);
      expect(countA.body.count).toBe(await prisma.notification.count({ where: { userId: id(CREDENTIALS.hr.username), readAt: null } }));

      // Marquer lue : 404, réponse identique à celle d'un identifiant inexistant
      const foreign = await server().patch(`/api/v1/notifications/${ofB.id}/read`).set('Cookie', cookieA);
      const unknown = await server().patch(`/api/v1/notifications/${UNKNOWN_ID}/read`).set('Cookie', cookieA);
      expect(foreign.status).toBe(404);
      expect(foreign.body).toEqual(unknown.body);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: ofB.id } })).readAt).toBeNull();

      // « Tout marquer comme lu » de A ne touche pas B
      await server().post('/api/v1/notifications/read-all').set('Cookie', cookieA);
      expect((await prisma.notification.findUniqueOrThrow({ where: { id: ofB.id } })).readAt).toBeNull();

      // Supprimer : aucune route de suppression n'existe (404), la notification reste en base
      const deletion = await server().delete(`/api/v1/notifications/${ofB.id}`).set('Cookie', cookieA);
      expect(deletion.status).toBe(404);
      expect(await prisma.notification.count({ where: { id: ofB.id } })).toBe(1);

      // Le SUPER_ADMIN non plus ne voit pas les notifications d'autrui
      const admin = await server().patch(`/api/v1/notifications/${ofB.id}/read`).set('Cookie', sessions.admin);
      expect(admin.status).toBe(404);

      // B, destinataire, la marque lue ; l'opération est idempotente
      const first = await server().patch(`/api/v1/notifications/${ofB.id}/read`).set('Cookie', sessions.employee);
      expect(first.status).toBe(200);
      expect(first.body.readAt).not.toBeNull();
      const second = await server().patch(`/api/v1/notifications/${ofB.id}/read`).set('Cookie', sessions.employee);
      expect(second.body.readAt).toBe(first.body.readAt);
    });

    it('identifiant non UUID : 400 générique', async () => {
      const response = await server().patch('/api/v1/notifications/abc/read').set('Cookie', sessions.employee);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Données invalides.');
    });
  });

  describe('liste, filtres et compteur (R22.1)', () => {
    it('ordre chronologique inverse, filtre lu / non lu, pagination, compteur', async () => {
      const username = 'k.haba';
      const cookie = await sessionCookie(app, { username, password: 'GF_Emp2026!' });
      await prisma.notification.deleteMany({ where: { userId: id(username) } });
      for (let i = 1; i <= 3; i += 1) {
        await prisma.notification.create({
          data: { userId: id(username), type: NotificationType.INFO, title: `N${i}`, message: 'm', createdAt: new Date(Date.UTC(2026, 10, i)) },
        });
      }
      const all = await server().get('/api/v1/notifications').set('Cookie', cookie);
      expect(all.body.data.map((n: { title: string }) => n.title)).toEqual(['N3', 'N2', 'N1']);
      await server().patch(`/api/v1/notifications/${all.body.data[0].id}/read`).set('Cookie', cookie);
      expect((await server().get('/api/v1/notifications?status=unread').set('Cookie', cookie)).body.total).toBe(2);
      expect((await server().get('/api/v1/notifications?status=read').set('Cookie', cookie)).body.total).toBe(1);
      expect((await server().get('/api/v1/notifications/unread-count').set('Cookie', cookie)).body).toEqual({ count: 2 });
      const page = await server().get('/api/v1/notifications?page=2&limit=2').set('Cookie', cookie);
      expect(page.body).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(page.body.data).toHaveLength(1);
      expect((await server().get('/api/v1/notifications?status=archived').set('Cookie', cookie)).status).toBe(400);
      const readAll = await server().post('/api/v1/notifications/read-all').set('Cookie', cookie);
      expect(readAll.body).toEqual({ updated: 2 });
      expect((await server().get('/api/v1/notifications/unread-count').set('Cookie', cookie)).body).toEqual({ count: 0 });
    });
  });

  describe('déclencheurs (M19, R23)', () => {
    it('critère 2.5 : un partage de document produit une notification visible par le destinataire', async () => {
      const recipient = 'a.diakite';
      const recipientCookie = await sessionCookie(app, { username: recipient, password: 'GF_Emp2026!' });
      const document = await prisma.document.findFirstOrThrow({ where: { confidentialityLevel: 'RESTRICTED' } });
      const before = await server().get('/api/v1/notifications/unread-count').set('Cookie', recipientCookie);

      const shared = await server()
        .post(`/api/v1/documents/${document.id}/permissions`)
        .set('Cookie', sessions.admin)
        .send({ userId: id(recipient), permission: 'READ' });
      expect(shared.status).toBe(201);

      const list = await server().get('/api/v1/notifications?status=unread').set('Cookie', recipientCookie);
      const notification = list.body.data.find((n: { type: string }) => n.type === 'DOCUMENT_SHARED');
      expect(notification).toMatchObject({
        type: 'DOCUMENT_SHARED',
        title: 'Document partagé avec vous',
        readAt: null,
      });
      expect(notification.message).toContain(`« ${document.title} »`);
      expect(notification.message).toContain(CREDENTIALS.admin.username);
      const after = await server().get('/api/v1/notifications/unread-count').set('Cookie', recipientCookie);
      expect(after.body.count).toBe(before.body.count + 1);

      // Partage refusé (doublon, 409) : aucune notification, la transaction est annulée
      const duplicate = await server()
        .post(`/api/v1/documents/${document.id}/permissions`)
        .set('Cookie', sessions.admin)
        .send({ userId: id(recipient), permission: 'READ' });
      expect(duplicate.status).toBe(409);
      expect(await notificationsOf(recipient, NotificationType.DOCUMENT_SHARED)).toHaveLength(1);
    });

    it('première connexion : aucune alerte ; nouvel appareil (user-agent ou IP inédits) : alerte SECURITY ; appareil connu : aucune', async () => {
      const username = 'b.yansane';
      expect(await prisma.session.count({ where: { userId: id(username) } })).toBe(0);
      const ip = nextIp();
      expect((await loginWith(username, 'GF_Emp2026!', ip, 'Navigateur-A/1.0')).status).toBe(200);
      expect(await notificationsOf(username, NotificationType.SECURITY)).toHaveLength(0);

      expect((await loginWith(username, 'GF_Emp2026!', ip, 'Navigateur-A/1.0')).status).toBe(200);
      expect(await notificationsOf(username, NotificationType.SECURITY)).toHaveLength(0);

      expect((await loginWith(username, 'GF_Emp2026!', ip, 'Navigateur-B/2.0')).status).toBe(200);
      const alerts = await notificationsOf(username, NotificationType.SECURITY);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].title).toBe('Connexion depuis un nouvel appareil');
      expect(alerts[0].message).toContain(ip);

      const otherIp = nextIp();
      const response = await loginWith(username, 'GF_Emp2026!', otherIp, 'Navigateur-A/1.0');
      expect(sessionTokenFrom(response)).toBeDefined();
      expect(await notificationsOf(username, NotificationType.SECURITY)).toHaveLength(2);
    });

    it('attribution et retrait de rôle : ROLE_CHANGED à l’utilisateur concerné', async () => {
      const username = 'm.dore';
      const target = await prisma.user.findUniqueOrThrow({ where: { username } });
      const roles = new Map((await prisma.role.findMany()).map((role) => [role.name, role.id]));
      const assign = await server()
        .put(`/api/v1/access/users/${target.id}/roles`)
        .set('Cookie', sessions.itAdmin)
        .send({ roleIds: [roles.get('EMPLOYEE'), roles.get('ACCOUNTANT')] });
      expect(assign.status).toBe(200);
      const [assigned] = await notificationsOf(username, NotificationType.ROLE_CHANGED);
      expect(assigned.title).toBe('Vos rôles ont changé');
      expect(assigned.message).toContain('attribué : Comptable');

      await server()
        .put(`/api/v1/access/users/${target.id}/roles`)
        .set('Cookie', sessions.itAdmin)
        .send({ roleIds: [roles.get('EMPLOYEE')] });
      const changes = await notificationsOf(username, NotificationType.ROLE_CHANGED);
      expect(changes).toHaveLength(2);
      expect(changes[1].message).toContain('retiré : Comptable');

      // Aucun changement : aucune notification
      await server()
        .put(`/api/v1/access/users/${target.id}/roles`)
        .set('Cookie', sessions.itAdmin)
        .send({ roleIds: [roles.get('EMPLOYEE')] });
      expect(await notificationsOf(username, NotificationType.ROLE_CHANGED)).toHaveLength(2);
    });

    it('modification de la matrice : ROLE_CHANGED à chaque titulaire du rôle, et à eux seuls', async () => {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: 'AUDITOR' }, include: { rolePermissions: true, userRoles: true } });
      const current = role.rolePermissions.map(({ permissionId }) => permissionId);
      const holders = role.userRoles.map(({ userId }) => userId);
      const extra = await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource: 'invoices', action: 'read' } } });
      const before = await prisma.notification.count({ where: { type: NotificationType.ROLE_CHANGED } });

      const response = await server()
        .put(`/api/v1/access/roles/${role.id}/permissions`)
        .set('Cookie', sessions.admin)
        .send({ permissionIds: [...current, extra.id] });
      expect(response.status).toBe(200);
      const created = await prisma.notification.findMany({
        where: { type: NotificationType.ROLE_CHANGED, title: 'Permissions de votre rôle modifiées' },
      });
      expect(created.map((n) => n.userId).sort()).toEqual([...holders].sort());
      expect(created[0].message).toContain('« Auditeur »');
      expect(await prisma.notification.count({ where: { type: NotificationType.ROLE_CHANGED } })).toBe(before + holders.length);

      await server().put(`/api/v1/access/roles/${role.id}/permissions`).set('Cookie', sessions.admin).send({ permissionIds: current });
    });

    it('verrouillage d’un compte : WARNING à chaque IT_ADMINISTRATOR actif, et à eux seuls', async () => {
      const itAdmins = await prisma.user.findMany({
        where: { status: 'ACTIVE', userRoles: { some: { role: { name: 'IT_ADMINISTRATOR' } } } },
        select: { id: true },
      });
      expect(itAdmins.length).toBeGreaterThan(0);
      const ip = nextIp();
      for (let i = 0; i < 5; i += 1) {
        await loginWith('l.sacko', 'mauvais', ip, 'Navigateur-A/1.0');
      }
      expect((await prisma.user.findUniqueOrThrow({ where: { username: 'l.sacko' } })).status).toBe('LOCKED');
      const warnings = await prisma.notification.findMany({ where: { type: NotificationType.WARNING } });
      expect(warnings.map((n) => n.userId).sort()).toEqual(itAdmins.map((u) => u.id).sort());
      expect(warnings[0]).toMatchObject({ title: 'Compte verrouillé' });
      expect(warnings[0].message).toContain('« l.sacko »');
      // M19 : ni l'IT_TECHNICIAN, ni le SUPER_ADMIN, ni le compte verrouillé
      expect(await notificationsOf(CREDENTIALS.itTech.username, NotificationType.WARNING)).toHaveLength(0);
      expect(await notificationsOf(CREDENTIALS.admin.username, NotificationType.WARNING)).toHaveLength(0);
    });

    it('verrouillage du dernier SUPER_ADMIN actif (M17) : alerte « Compte Super Admin verrouillé » aux ITA', async () => {
      const ip = nextIp();
      for (let i = 0; i < 5; i += 1) {
        await loginWith(CREDENTIALS.admin.username, 'mauvais', ip, 'Navigateur-A/1.0');
      }
      const alerts = await notificationsOf(CREDENTIALS.itAdmin.username, NotificationType.WARNING);
      expect(alerts.at(-1)).toMatchObject({ title: 'Compte Super Admin verrouillé' });
      expect(alerts.at(-1)!.message).toContain(`« ${CREDENTIALS.admin.username} »`);
      // Remise en état : expiration du verrou (I14)
      await prisma.authEvent.updateMany({
        where: { userId: id(CREDENTIALS.admin.username), eventType: AuthEventType.ACCOUNT_LOCKED },
        data: { timestamp: new Date(Date.now() - LOCK_DURATION_MS - 60_000) },
      });
      sessions.admin = await sessionCookie(app, CREDENTIALS.admin);
    });

    it('création d’un employé avec responsable : INFO au compte du responsable ; sans responsable : aucune', async () => {
      const department = await prisma.department.findUniqueOrThrow({ where: { code: 'AC' }, include: { positions: true } });
      const manager = await prisma.employee.findFirstOrThrow({ where: { identity: { is: { userId: id(CREDENTIALS.manager.username) } } } });
      const body = (suffix: string, managerId?: string) => ({
        firstName: 'Nouvel',
        lastName: `Collègue${suffix}`,
        professionalEmail: `nouvel.collegue${suffix}@guineasf.com`,
        departmentId: department.id,
        positionId: department.positions[0].id,
        hireDate: '2026-11-02',
        ...(managerId ? { managerId } : {}),
      });
      const before = await notificationsOf(CREDENTIALS.manager.username, NotificationType.INFO);
      const created = await server().post('/api/v1/employees').set('Cookie', sessions.hr).send(body('A', manager.id));
      expect(created.status).toBe(201);
      const after = await notificationsOf(CREDENTIALS.manager.username, NotificationType.INFO);
      expect(after).toHaveLength(before.length + 1);
      expect(after.at(-1)).toMatchObject({ title: 'Nouvel employé dans votre équipe' });
      expect(after.at(-1)!.message).toContain(`Nouvel CollègueA (${created.body.employeeNumber})`);

      const total = await prisma.notification.count({ where: { type: NotificationType.INFO } });
      expect((await server().post('/api/v1/employees').set('Cookie', sessions.hr).send(body('B'))).status).toBe(201);
      expect(await prisma.notification.count({ where: { type: NotificationType.INFO } })).toBe(total);
    });
  });

  it('dashboard EMPLOYEE : « Mes notifications » = ses 5 dernières notifications', async () => {
    const username = CREDENTIALS.employee.username;
    for (let i = 0; i < 6; i += 1) await createFor(username, `Récente ${i}`);
    const response = await server().get('/api/v1/dashboard').set('Cookie', sessions.employee);
    const latest = await prisma.notification.findMany({
      where: { userId: id(username) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
    });
    expect(response.body.recentNotifications.map((n: { id: string }) => n.id)).toEqual(latest.map((n) => n.id));
    // Aucune carte de notifications pour les autres rôles
    expect((await server().get('/api/v1/dashboard').set('Cookie', sessions.hr)).body.recentNotifications).toBeUndefined();
  });
});
