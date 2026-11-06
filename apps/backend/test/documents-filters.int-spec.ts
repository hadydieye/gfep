import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfidentialityLevel, type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { CREDENTIALS, createTestApp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 3.1 — Filtres `ownerId` et `departmentId` de `GET /documents`
 * (gfep-mvp3 R9.1, N11) : département au sens de M8, toujours combinés avec la
 * visibilité M9 de l'utilisateur connecté.
 */
describe('Documents : filtres propriétaire et département (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let admin: string;
  let employee: string;

  const list = async (query: string, cookie: string) => {
    const response = await request(app.getHttpServer()).get(`/api/v1/documents?limit=100&${query}`).set('Cookie', cookie);
    expect(response.status).toBe(200);
    return (response.body.data as Array<{ id: string }>).map((d) => d.id).sort();
  };

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    admin = await sessionCookie(app, CREDENTIALS.admin);
    employee = await sessionCookie(app, CREDENTIALS.employee);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('ownerId : documents de ce propriétaire uniquement (SUPER_ADMIN voit tout)', async () => {
    const owner = await prisma.document.groupBy({ by: ['ownerId'], _count: true, orderBy: { _count: { ownerId: 'desc' } }, take: 1 });
    const ownerId = owner[0].ownerId;
    const expected = (await prisma.document.findMany({ where: { ownerId }, select: { id: true } })).map((d) => d.id).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(await list(`ownerId=${ownerId}`, admin)).toEqual(expected);
  });

  it('departmentId : département de la catégorie, à défaut celui du propriétaire (M8)', async () => {
    const departments = await prisma.department.findMany();
    const documents = await prisma.document.findMany({ include: { category: true, owner: true } });
    for (const department of departments) {
      const expected = documents
        .filter((d) => (d.category.departmentId ?? d.owner.departmentId) === department.id)
        .map((d) => d.id)
        .sort();
      expect(await list(`departmentId=${department.id}`, admin)).toEqual(expected);
    }
  });

  it('M9 reste appliquée : un EMPLOYEE ne voit, dans un département, que ses documents visibles', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { username: CREDENTIALS.employee.username },
      include: { employeeIdentity: { include: { employee: true } } },
    });
    const own = user.employeeIdentity!.employee;
    const other = await prisma.department.findFirstOrThrow({ where: { id: { not: own.departmentId } } });
    const documents = await prisma.document.findMany({ include: { category: true, owner: true, permissions: true } });
    const visible = (d: (typeof documents)[number]) => {
      const departmentId = d.category.departmentId ?? d.owner.departmentId;
      return (
        d.ownerId === own.id ||
        d.confidentialityLevel === ConfidentialityLevel.PUBLIC ||
        (d.confidentialityLevel === ConfidentialityLevel.INTERNAL && departmentId === own.departmentId) ||
        d.permissions.some((p) => p.userId === user.id)
      );
    };
    const expected = documents
      .filter((d) => (d.category.departmentId ?? d.owner.departmentId) === other.id && visible(d))
      .map((d) => d.id)
      .sort();
    const hidden = documents.filter((d) => (d.category.departmentId ?? d.owner.departmentId) === other.id && !visible(d));
    expect(hidden.length).toBeGreaterThan(0);
    const result = await list(`departmentId=${other.id}`, employee);
    expect(result).toEqual(expected);
    for (const document of hidden) expect(result).not.toContain(document.id);
  });

  it('identifiant non UUID → 400 générique', async () => {
    for (const query of ['ownerId=abc', 'departmentId=1']) {
      const response = await request(app.getHttpServer()).get(`/api/v1/documents?${query}`).set('Cookie', admin);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Données invalides.');
    }
  });
});
