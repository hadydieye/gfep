import type { NestExpressApplication } from '@nestjs/platform-express';
import { EmploymentStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  CREDENTIALS,
  createTestApp,
  resetDatabase,
  seedOrThrow,
  sessionCookie,
  testPrisma,
} from './helpers.js';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Dashboard, Employés, Départements (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let cookies: { admin: string; manager: string; employee: string };

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
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const get = (path: string, cookie = cookies.employee) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Cookie', cookie);
  const activeCount = (departmentId?: string) =>
    prisma.employee.count({ where: { employmentStatus: EmploymentStatus.ACTIVE, departmentId } });
  const department = (code: string) =>
    prisma.department.findUniqueOrThrow({ where: { code }, include: { positions: true } });

  describe('GET /dashboard', () => {
    it('SUPER_ADMIN : effectif global actif', async () => {
      const response = await get('/dashboard', cookies.admin);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        role: 'SUPER_ADMIN',
        indicators: { totalEmployees: await activeCount() },
        recentActivity: [],
      });
    });

    it('DEPARTMENT_MANAGER : effectif et nom de son département uniquement', async () => {
      const rh = await department('RH');
      const response = await get('/dashboard', cookies.manager);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        role: 'DEPARTMENT_MANAGER',
        indicators: { departmentEmployees: await activeCount(rh.id), departmentName: 'Ressources humaines' },
        recentActivity: [],
      });
      const expectedPending = await prisma.document.findMany({
        where: {
          validationStatus: 'PENDING',
          category: { is: { departmentId: rh.id } },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(response.body.pendingDocuments.map((item: { id: string }) => item.id)).toEqual(
        expectedPending.map(({ id }) => id),
      );
    });

    it('EMPLOYEE : aucun indicateur chiffré', async () => {
      const response = await get('/dashboard', cookies.employee);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ role: 'EMPLOYEE', indicators: {}, recentActivity: [] });
      const visibleDocuments = await get('/documents?limit=100', cookies.employee);
      expect(response.body.recentDocuments.map((item: { id: string }) => item.id)).toEqual(
        visibleDocuments.body.data.slice(0, 5).map((item: { id: string }) => item.id),
      );
    });
  });

  describe('GET /employees/:id', () => {
    it('200 avec département, poste et responsable', async () => {
      const diallo = await prisma.employee.findUniqueOrThrow({ where: { employeeNumber: 'GF-2026-002' } });
      const response = await get(`/employees/${diallo.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        employeeNumber: 'GF-2026-002',
        firstName: 'Mamadou',
        department: { code: 'CF', name: 'Comptabilité et finances' },
        position: { title: 'Responsable comptable' },
        // Seed complet (M5) : les responsables de département rapportent au Directeur général
        manager: { firstName: 'Thierno', lastName: 'Baldé' },
        employmentStatus: 'ACTIVE',
      });
    });

    it('404 pour un identifiant inconnu', async () => {
      const response = await get(`/employees/${UNKNOWN_ID}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Employé introuvable.');
    });
  });

  describe('GET /employees : pagination, recherche, filtres', () => {
    it('limite par défaut 25, page 1', async () => {
      const response = await get('/employees');
      expect(response.body).toMatchObject({ page: 1, limit: 25, total: 40 });
      expect(response.body.data).toHaveLength(25);
    });

    it('pages de 10 : 4 pages disjointes couvrant les 40 employés, triées par nom', async () => {
      const pages = await Promise.all([1, 2, 3, 4, 5].map((page) => get(`/employees?page=${page}&limit=10`)));
      const ids = pages.slice(0, 4).flatMap((p) => p.body.data.map((e: { id: string }) => e.id));
      expect(pages.slice(0, 4).map((p) => p.body.data.length)).toEqual([10, 10, 10, 10]);
      expect(new Set(ids).size).toBe(40);
      expect(pages[4].body).toMatchObject({ data: [], total: 40, page: 5, limit: 10 });

      const all = (await get('/employees')).body.data.map((e: { lastName: string }) => e.lastName);
      expect(all).toEqual([...all].sort((a: string, b: string) => a.localeCompare(b)));
    });

    it('limit au-delà de 100 ou page 0 : 400', async () => {
      expect((await get('/employees?limit=101')).status).toBe(400);
      expect((await get('/employees?page=0')).status).toBe(400);
    });

    it.each([
      ['diallo', ['GF-2026-002']],
      ['MAMADOU Diallo', ['GF-2026-002']],
      ['cam', ['GF-2026-001']],
      ['inexistant', []],
    ])('recherche "%s"', async (search, expected) => {
      const response = await get(`/employees?search=${encodeURIComponent(search)}`);
      expect(response.body.data.map((e: { employeeNumber: string }) => e.employeeNumber)).toEqual(expected);
      expect(response.body.total).toBe(expected.length);
    });

    it('filtre par département', async () => {
      const it = await department('IT');
      const response = await get(`/employees?departmentId=${it.id}`);
      expect(response.body.total).toBe(7);
      const members = response.body.data as Array<{ lastName: string; department: { code: string } }>;
      expect(members.every((e) => e.department.code === 'IT')).toBe(true);
      // Mohamed Keïta a rejoint l'IT (M5)
      expect(members.map((e) => e.lastName)).toEqual(expect.arrayContaining(['Sow', 'Keïta', 'Kaba']));
    });

    it('filtre par statut', async () => {
      expect((await get('/employees?status=ACTIVE')).body.total).toBe(40);
      expect((await get('/employees?status=SUSPENDED')).body.total).toBe(0);
      expect((await get('/employees?status=INCONNU')).status).toBe(400);
    });
  });

  describe('POST /employees par un DEPARTMENT_MANAGER', () => {
    it('création dans son département : 201', async () => {
      const rh = await department('RH');
      const response = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Cookie', cookies.manager)
        .send({
          firstName: 'Mariama',
          lastName: 'Soumah',
          professionalEmail: 'm.soumah@guineasf.com',
          departmentId: rh.id,
          positionId: rh.positions[0].id,
          hireDate: '2026-03-02',
        });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        lastName: 'Soumah',
        department: { code: 'RH' },
        employmentStatus: 'ACTIVE',
      });
      expect(await prisma.employee.count({ where: { lastName: 'Soumah' } })).toBe(1);
    });
  });

  describe('Départements : effectif et détail', () => {
    it('liste : 6 départements, effectif = employés actifs en base', async () => {
      const response = await get('/departments');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(6);
      for (const item of response.body as Array<{ id: string; headcount: number }>) {
        expect(item.headcount).toBe(await activeCount(item.id));
      }
      const rh = (response.body as Array<{ code: string; headcount: number }>).find((d) => d.code === 'RH');
      expect(rh?.headcount).toBe(7); // 6 employés RH du seed + Soumah créée ci-dessus
    });

    it('l’effectif suit les changements de statut (employé suspendu exclu)', async () => {
      const it = await department('IT');
      await prisma.employee.updateMany({
        where: { departmentId: it.id },
        data: { employmentStatus: EmploymentStatus.SUSPENDED },
      });
      const response = await get(`/departments/${it.id}`);
      expect(response.body.headcount).toBe(0);
      expect(response.body.employees).toEqual([]);
    });

    it('détail RH : responsable, postes et équipe active', async () => {
      const rh = await department('RH');
      const response = await get(`/departments/${rh.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        code: 'RH',
        name: 'Ressources humaines',
        headcount: 7,
        manager: { firstName: 'Fatoumata', lastName: 'Camara', position: 'Responsable RH' },
        // Postes triés par niveau hiérarchique
        positions: [{ title: 'Responsable RH' }, { title: 'Chargé(e) RH' }, { title: 'Assistant(e) RH' }],
      });
      const team = response.body.employees.map((e: { lastName: string }) => e.lastName);
      expect(team).toHaveLength(7);
      expect(team).toEqual(expect.arrayContaining(['Camara', 'Soumah', 'Bah', 'Kanté']));
    });

    it('404 pour un département inconnu', async () => {
      const response = await get(`/departments/${UNKNOWN_ID}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Département introuvable.');
    });
  });
});
