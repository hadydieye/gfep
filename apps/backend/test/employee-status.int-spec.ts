import type { NestExpressApplication } from '@nestjs/platform-express';
import { EmploymentStatus, PrismaClient, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AuditService } from '../src/audit/audit.service.js';
import { CREDENTIALS, createTestApp, login, nextIp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/** Étape 2.4 — report T2.4.R1 : PATCH /employees/:id/status (R17, M16). */
type RoleKey = keyof typeof CREDENTIALS;
const ROLE_KEYS = Object.keys(CREDENTIALS) as RoleKey[];

describe('Changement de statut d’un employé (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: Record<RoleKey, string>;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = Object.fromEntries(
      await Promise.all(ROLE_KEYS.map(async (key) => [key, await sessionCookie(app, CREDENTIALS[key])] as const)),
    ) as Record<RoleKey, string>;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const patchStatus = (cookie: string, employeeId: string, status: string) =>
    request(app.getHttpServer()).patch(`/api/v1/employees/${employeeId}/status`).set('Cookie', cookie).send({ status });
  const employeeOf = (username: string) =>
    prisma.employee.findFirstOrThrow({ where: { identity: { is: { user: { username } } } }, include: { identity: { include: { user: true } } } });
  /** Employé EMPLOYEE d'un département, avec compte, hors comptes nommés */
  const plainEmployee = async (departmentCode: string, skip = 0) =>
    prisma.employee.findFirstOrThrow({
      where: {
        department: { code: departmentCode },
        employmentStatus: EmploymentStatus.ACTIVE,
        identity: { is: { user: { status: UserStatus.ACTIVE, userRoles: { every: { role: { name: 'EMPLOYEE' } } } } } },
      },
      orderBy: { employeeNumber: 'desc' },
      skip,
      include: { identity: { include: { user: true } } },
    });

  it.each<[RoleKey, string, number]>([
    ['admin', 'CO', 200],
    ['hr', 'CO', 200], // HR_MANAGER : tous les départements
    ['manager', 'AC', 200], // DM dans son département
    ['manager', 'CO', 403], // DM hors de son département
    ['itAdmin', 'CO', 403],
    ['itTech', 'CO', 403],
    ['accountant', 'CO', 403],
    ['employee', 'CO', 403],
    ['auditor', 'CO', 403],
  ])('%s sur un employé %s → %i', async (key, departmentCode, expected) => {
    const target = await plainEmployee(departmentCode);
    const response = await patchStatus(sessions[key], target.id, 'SUSPENDED');
    expect(response.status).toBe(expected);
    const after = await prisma.employee.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.employmentStatus).toBe(expected === 200 ? 'SUSPENDED' : 'ACTIVE');
  });

  it('suspension : employé et compte suspendus, sessions révoquées, audit, dans une transaction', async () => {
    const target = await plainEmployee('CF');
    const username = target.identity!.user.username;
    const cookie = await sessionCookie(app, { username, password: 'GF_Emp2026!' });
    expect((await request(app.getHttpServer()).get('/api/v1/dashboard').set('Cookie', cookie)).status).toBe(200);

    const response = await patchStatus(sessions.hr, target.id, 'SUSPENDED');
    expect(response.status).toBe(200);
    expect(response.body.employmentStatus).toBe('SUSPENDED');
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    expect(user.status).toBe(UserStatus.SUSPENDED);
    expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
    expect((await request(app.getHttpServer()).get('/api/v1/dashboard').set('Cookie', cookie)).status).toBe(401);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { resourceId: target.id, action: 'employee.status_change' } });
    expect(log.oldValues).toMatchObject({ employmentStatus: 'ACTIVE', accountStatus: 'ACTIVE' });
    expect(log.newValues).toMatchObject({ employmentStatus: 'SUSPENDED', accountStatus: 'SUSPENDED' });
    expect((log.newValues as { revokedSessions: number }).revokedSessions).toBeGreaterThanOrEqual(1);
  });

  it('sortie définitive (TERMINATED) : compte suspendu également', async () => {
    const target = await plainEmployee('IT');
    expect((await patchStatus(sessions.admin, target.id, 'TERMINATED')).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.identity!.user.id } })).status).toBe(UserStatus.SUSPENDED);
  });

  it('réactivation : seule la fiche redevient active, le compte reste suspendu', async () => {
    const target = await plainEmployee('RH');
    const username = target.identity!.user.username;
    expect((await patchStatus(sessions.hr, target.id, 'SUSPENDED')).status).toBe(200);
    const response = await patchStatus(sessions.hr, target.id, 'ACTIVE');
    expect(response.status).toBe(200);
    expect(response.body.employmentStatus).toBe('ACTIVE');
    expect((await prisma.user.findUniqueOrThrow({ where: { username } })).status).toBe(UserStatus.SUSPENDED);
    expect((await login(app, { username, password: 'GF_Emp2026!' }, nextIp())).status).toBe(401);
  });

  it('interdit de changer son propre statut (403)', async () => {
    const own = await employeeOf(CREDENTIALS.hr.username);
    expect((await patchStatus(sessions.hr, own.id, 'SUSPENDED')).status).toBe(403);
    const manager = await employeeOf(CREDENTIALS.manager.username);
    expect((await patchStatus(sessions.manager, manager.id, 'SUSPENDED')).status).toBe(403);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: own.id } })).employmentStatus).toBe('ACTIVE');
  });

  it('suspendre l’employé d’un SUPER_ADMIN suit M17 : refusé à un non-SUPER_ADMIN', async () => {
    const director = await employeeOf(CREDENTIALS.admin.username);
    expect((await patchStatus(sessions.hr, director.id, 'SUSPENDED')).status).toBe(403);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: director.id } })).employmentStatus).toBe('ACTIVE');
    expect((await prisma.user.findUniqueOrThrow({ where: { username: CREDENTIALS.admin.username } })).status).toBe('ACTIVE');
  });

  it('même statut → 409 ; statut inconnu → 400 ; employé inconnu → 404', async () => {
    const target = await plainEmployee('CO', 1);
    expect((await patchStatus(sessions.admin, target.id, 'ACTIVE')).status).toBe(409);
    expect((await patchStatus(sessions.admin, target.id, 'RETIRED')).status).toBe(400);
    expect((await patchStatus(sessions.admin, '00000000-0000-4000-8000-000000000000', 'SUSPENDED')).status).toBe(404);
  });

  it('atomicité : un échec de l’audit n’écrit rien (statut, compte, sessions)', async () => {
    const target = await plainEmployee('DG');
    const username = target.identity!.user.username;
    await sessionCookie(app, { username, password: 'GF_Emp2026!' });
    vi.spyOn(app.get(AuditService), 'record').mockRejectedValueOnce(new Error('panne simulée'));

    expect((await patchStatus(sessions.admin, target.id, 'SUSPENDED')).status).toBe(500);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: target.id } })).employmentStatus).toBe('ACTIVE');
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    expect(user.status).toBe(UserStatus.ACTIVE);
    expect(await prisma.session.count({ where: { userId: user.id, revokedAt: null } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditLog.count({ where: { resourceId: target.id } })).toBe(0);
  });

  it('employé sans compte : statut modifié, aucune écriture de compte', async () => {
    const department = await prisma.department.findUniqueOrThrow({ where: { code: 'CO' }, include: { positions: true } });
    const created = await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Cookie', sessions.hr)
      .send({
        firstName: 'Sans',
        lastName: 'Compte',
        professionalEmail: 'sans.compte@guineasf.com',
        departmentId: department.id,
        positionId: department.positions[0].id,
        hireDate: '2026-01-05',
      });
    expect(created.status).toBe(201);
    const response = await patchStatus(sessions.hr, created.body.id, 'SUSPENDED');
    expect(response.status).toBe(200);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { resourceId: created.body.id, action: 'employee.status_change' } });
    expect(log.newValues).toEqual({ employmentStatus: 'SUSPENDED', revokedSessions: 0 });
  });
});
