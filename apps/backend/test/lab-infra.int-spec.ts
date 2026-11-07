import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createLabTestApp, createTestApp } from './lab-helpers.js';
import { resetDatabase, seedOrThrow, testPrisma } from './helpers.js';
import type { PrismaClient } from '@prisma/client';

/**
 * T-INFRA-1 — Infrastructure du module lab (R-LAB-2) :
 * - LAB_MODE=false : aucune route de lab n'existe (404)
 * - LAB_MODE=true (simulé par createLabTestApp) : les routes de lab répondent
 */
describe('Lab infrastructure', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('LAB_MODE=false : GET /api/v1/lab/ping -> 404 (route absente)', async () => {
    const app: NestExpressApplication = await createTestApp();
    const res = await request(app.getHttpServer()).get('/api/v1/lab/ping');
    expect(res.status).toBe(404);
    await app.close();
  });

  it('LAB_MODE=true : GET /api/v1/lab/ping -> 200 (module monté)', async () => {
    const app: NestExpressApplication = await createLabTestApp();
    const res = await request(app.getHttpServer()).get('/api/v1/lab/ping');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', labMode: true });
    await app.close();
  });

  it('LAB_MODE=true : routes de production intactes (GET /health)', async () => {
    const app: NestExpressApplication = await createLabTestApp();
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    await app.close();
  });
});
