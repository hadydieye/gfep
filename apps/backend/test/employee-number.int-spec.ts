import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  CREDENTIALS,
  createTestApp,
  resetDatabase,
  seedOrThrow,
  sessionCookie,
  testPrisma,
} from './helpers.js';

describe('Numéro d’employé (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let adminCookie: string;
  let rh: { id: string; positionId: string };

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    adminCookie = await sessionCookie(app, CREDENTIALS.admin);
    const department = await prisma.department.findUniqueOrThrow({
      where: { code: 'RH' },
      include: { positions: true },
    });
    rh = { id: department.id, positionId: department.positions[0].id };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const create = (suffix: string) =>
    request(app.getHttpServer())
      .post('/api/v1/employees')
      .set('Cookie', adminCookie)
      .send({
        firstName: 'Concurrent',
        lastName: suffix,
        professionalEmail: `concurrent.${suffix}@guineasf.com`,
        departmentId: rh.id,
        positionId: rh.positionId,
        hireDate: '2026-02-01',
      });

  it('5 créations simultanées : toutes 201, numéros distincts et consécutifs', async () => {
    const year = new Date().getFullYear();
    const prefix = `GF-${year}-`;
    const before = await prisma.employee.findMany({
      where: { employeeNumber: { startsWith: prefix } },
      select: { employeeNumber: true },
    });
    const max = Math.max(0, ...before.map((e) => Number(e.employeeNumber.slice(prefix.length))));

    const responses = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(create));

    expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    const numbers = responses.map((r) => r.body.employeeNumber as string).sort();
    expect(new Set(numbers).size).toBe(5);
    expect(numbers).toEqual(
      [1, 2, 3, 4, 5].map((i) => `${prefix}${String(max + i).padStart(3, '0')}`),
    );
  });

  it('email en doublon : 409 avec le message email', async () => {
    const first = await create('doublon');
    expect(first.status).toBe(201);
    const duplicate = await create('doublon');
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toBe('Un employé avec cet email professionnel existe déjà.');
  });
});
