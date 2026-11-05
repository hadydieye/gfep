import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  CREDENTIALS,
  createTestApp,
  login,
  nextIp,
  resetDatabase,
  seedOrThrow,
  sessionCookie,
  testPrisma,
} from './helpers.js';

const GENERIC_400 = { statusCode: 400, error: 'Bad Request', message: 'Données invalides.' };

describe('Erreurs de validation sans fuite (design.md §11 Property 1)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let adminCookie: string;
  let valid: Record<string, string>;
  let otherDepartmentPosition: string;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    adminCookie = await sessionCookie(app, CREDENTIALS.admin);
    const rh = await prisma.department.findUniqueOrThrow({
      where: { code: 'RH' },
      include: { positions: true },
    });
    const it = await prisma.department.findUniqueOrThrow({
      where: { code: 'IT' },
      include: { positions: true },
    });
    otherDepartmentPosition = it.positions[0].id;
    valid = {
      firstName: 'Awa',
      lastName: 'Condé',
      professionalEmail: 'a.conde@guineasf.com',
      departmentId: rh.id,
      positionId: rh.positions[0].id,
      hireDate: '2026-01-05',
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const postEmployee = (body: object | string) => {
    const req = request(app.getHttpServer()).post('/api/v1/employees').set('Cookie', adminCookie);
    return typeof body === 'string'
      ? req.set('Content-Type', 'application/json').send(body)
      : req.send(body);
  };

  it('login avec un champ inconnu : 400 générique, le nom du champ n’est pas renvoyé', async () => {
    const response = await login(app, { ...CREDENTIALS.admin, isAdmin: true } as never);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(GENERIC_400);
    expect(response.text).not.toContain('isAdmin');
  });

  it('création avec champ inconnu seul : 400 générique sans liste de champs', async () => {
    const response = await postEmployee({ ...valid, salary: 1_000_000 });
    expect(response.status).toBe(400);
    expect(response.body).toEqual(GENERIC_400);
    expect(response.text).not.toContain('salary');
  });

  it('champ légitime invalide + champ inconnu : seul le champ légitime est listé', async () => {
    const response = await postEmployee({ ...valid, professionalEmail: 'pas-un-email', salary: 1 });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ ...GENERIC_400, fields: ['professionalEmail'] });
    expect(response.text).not.toContain('salary');
    expect(response.text).not.toMatch(/must be an email|should not exist/);
  });

  it('JSON mal formé : 400 générique, sans message du parseur', async () => {
    const response = await postEmployee('{"firstName":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual(GENERIC_400);
    expect(response.text).not.toMatch(/JSON|Unexpected/);
  });

  it('identifiant non UUID : 400 générique, sans détail du pipe', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/employees/pas-un-uuid')
      .set('Cookie', adminCookie);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(GENERIC_400);
    expect(response.text).not.toMatch(/uuid|Validation failed/i);
  });

  it('paramètre de requête inconnu : 400 générique, le nom n’est pas renvoyé', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/employees?debug=1')
      .set('Cookie', adminCookie);
    expect(response.status).toBe(400);
    expect(response.body).toEqual(GENERIC_400);
    expect(response.text).not.toContain('debug');
  });

  it('les règles métier volontaires gardent leur message utilisateur', async () => {
    const response = await postEmployee({ ...valid, positionId: otherDepartmentPosition });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Le poste n'appartient pas au département choisi.");
  });

  it('login sans corps : 400 générique (et non 401)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', nextIp())
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Données invalides.');
  });
});
