import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  CREDENTIALS,
  createTestApp,
  login,
  resetDatabase,
  seedOrThrow,
  sessionCookie,
  testPrisma,
} from './helpers.js';

describe('RBAC et validation (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let cookies: { admin: string; manager: string; employee: string };
  let ids: {
    rhDepartment: string;
    rhPosition: string;
    rhEmployee: string;
    itEmployee: string;
    itDepartment: string;
  };

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();

    cookies = {
      admin: await sessionCookie(app, CREDENTIALS.admin),
      manager: await sessionCookie(app, CREDENTIALS.manager),
      employee: await sessionCookie(app, CREDENTIALS.employee),
    };
    // Département du DEPARTMENT_MANAGER a.barry : Audit et conformité (M5, étape 2.4)
    const rh = await prisma.department.findUniqueOrThrow({
      where: { code: 'AC' },
      include: { positions: true },
    });
    const it = await prisma.department.findUniqueOrThrow({ where: { code: 'IT' } });
    ids = {
      rhDepartment: rh.id,
      rhPosition: rh.positions[0].id,
      rhEmployee: (
        await prisma.employee.findFirstOrThrow({
          where: { departmentId: rh.id, employeeNumber: { not: 'GF-2026-005' } },
          orderBy: { employeeNumber: 'asc' },
        })
      ).id,
      itEmployee: (await prisma.employee.findUniqueOrThrow({ where: { employeeNumber: 'GF-2026-003' } })).id,
      itDepartment: it.id,
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  let emailCounter = 0;
  const newEmployee = (overrides: Record<string, unknown> = {}) => {
    emailCounter += 1;
    return {
      firstName: 'Test',
      lastName: `Agent${emailCounter}`,
      professionalEmail: `test.agent${emailCounter}@guineasf.com`,
      departmentId: ids.rhDepartment,
      positionId: ids.rhPosition,
      hireDate: '2026-01-05',
      ...overrides,
    };
  };

  const post = (cookie: string, body: object) =>
    request(app.getHttpServer()).post('/api/v1/employees').set('Cookie', cookie).send(body);
  const patch = (cookie: string, id: string, body: object) =>
    request(app.getHttpServer()).patch(`/api/v1/employees/${id}`).set('Cookie', cookie).send(body);

  describe('EMPLOYEE', () => {
    it('403 sur la création d’un employé', async () => {
      const response = await post(cookies.employee, newEmployee());
      expect(response.status).toBe(403);
      expect(await prisma.employee.count({ where: { lastName: `Agent${emailCounter}` } })).toBe(0);
    });

    it('403 sur la modification d’un employé', async () => {
      const response = await patch(cookies.employee, ids.rhEmployee, { phone: '+224620000001' });
      expect(response.status).toBe(403);
    });

    it('lecture autorisée', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/employees')
        .set('Cookie', cookies.employee);
      expect(response.status).toBe(200);
    });
  });

  describe('DEPARTMENT_MANAGER (AC)', () => {
    it('modification autorisée dans son département', async () => {
      const response = await patch(cookies.manager, ids.rhEmployee, { phone: '+224620000002' });
      expect(response.status).toBe(200);
      expect(response.body.phone).toBe('+224620000002');
    });

    it('403 sur un employé d’un autre département', async () => {
      const response = await patch(cookies.manager, ids.itEmployee, { phone: '+224620000003' });
      expect(response.status).toBe(403);
      const unchanged = await prisma.employee.findUniqueOrThrow({ where: { id: ids.itEmployee } });
      expect(unchanged.phone).toBeNull();
    });

    it('403 en déplaçant un employé de son département vers un autre', async () => {
      const response = await patch(cookies.manager, ids.rhEmployee, {
        departmentId: ids.itDepartment,
      });
      expect(response.status).toBe(403);
    });

    it('403 en créant un employé dans un autre département', async () => {
      const response = await post(cookies.manager, newEmployee({ departmentId: ids.itDepartment }));
      expect(response.status).toBe(403);
    });
  });

  describe('SUPER_ADMIN', () => {
    it('création autorisée (201) avec numéro GF-AAAA-NNN', async () => {
      const response = await post(cookies.admin, newEmployee());
      expect(response.status).toBe(201);
      expect(response.body.employeeNumber).toMatch(/^GF-\d{4}-\d{3}$/);
    });

    it('modification autorisée dans n’importe quel département', async () => {
      const response = await patch(cookies.admin, ids.itEmployee, { phone: '+224620000004' });
      expect(response.status).toBe(200);
    });

    it('accès au dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Cookie', cookies.admin);
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('SUPER_ADMIN');
    });
  });

  describe('validation', () => {
    it('champ inconnu dans le DTO de création : 400', async () => {
      const response = await post(cookies.admin, newEmployee({ salary: 1_000_000 }));
      expect(response.status).toBe(400);
    });

    it('champ inconnu dans le DTO de modification : 400', async () => {
      const response = await patch(cookies.admin, ids.rhEmployee, { isAdmin: true });
      expect(response.status).toBe(400);
    });

    it('champ inconnu dans le DTO de login : 400', async () => {
      const response = await login(app, { ...CREDENTIALS.admin, role: 'SUPER_ADMIN' } as never);
      expect(response.status).toBe(400);
    });

    it('email professionnel en doublon : 409', async () => {
      const body = newEmployee();
      expect((await post(cookies.admin, body)).status).toBe(201);
      const duplicate = await post(cookies.admin, { ...body, lastName: 'Doublon' });
      expect(duplicate.status).toBe(409);
    });
  });

  describe('endpoints protégés sans session : 401', () => {
    const uuid = '00000000-0000-4000-8000-000000000000';
    it.each([
      ['GET', '/api/v1/auth/me'],
      ['POST', '/api/v1/auth/logout'],
      ['GET', '/api/v1/dashboard'],
      ['GET', '/api/v1/employees'],
      ['GET', `/api/v1/employees/${uuid}`],
      ['POST', '/api/v1/employees'],
      ['PATCH', `/api/v1/employees/${uuid}`],
      ['GET', '/api/v1/departments'],
      ['GET', `/api/v1/departments/${uuid}`],
    ])('%s %s', async (method, path) => {
      const server = request(app.getHttpServer());
      const call =
        method === 'GET' ? server.get(path) : method === 'POST' ? server.post(path) : server.patch(path);
      expect((await call.send({})).status).toBe(401);
    });
  });
});
