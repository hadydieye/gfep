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
import { createLabTestApp } from './lab-helpers.js';

/**
 * WEB-01 — SQL Injection (T-WEB01-2).
 * Double preuve : exploitation (LAB_MODE=true) + blocage (LAB_MODE=false).
 */
type Role = keyof typeof CREDENTIALS;

describe('WEB-01 — SQL Injection (lab)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // -------------------------------------------------------
  // LAB_MODE=true : exploitation
  // -------------------------------------------------------
  describe('LAB_MODE=true', () => {
    let app: NestExpressApplication;
    let cookie: string;

    beforeAll(async () => {
      app = await createLabTestApp();
      cookie = await sessionCookie(app, CREDENTIALS.admin);
    });

    afterAll(async () => {
      await app.close();
    });

    it('recherche normale retourne des employes', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/lab/employees/search?q=Mamadou')
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // Chaque ligne a les colonnes attendues
      expect(res.body[0]).toHaveProperty('firstName');
      expect(res.body[0]).toHaveProperty('lastName');
    });

    it('UNION payload exfiltre passwordHash de users', async () => {
      const payload = "' UNION SELECT id, username, email, \"passwordHash\", NULL, NULL, NULL, NULL FROM users --";
      const res = await request(app.getHttpServer())
        .get(`/api/v1/lab/employees/search?q=${encodeURIComponent(payload)}`)
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Au moins une ligne contient un hash argon2 dans 'lastName'
      const hashRows = res.body.filter(
        (row: Record<string, unknown>) =>
          typeof row.lastName === 'string' && row.lastName.startsWith('$argon2'),
      );
      expect(hashRows.length).toBeGreaterThan(0);
      // Le hash ne contient jamais le mot de passe en clair
      for (const row of hashRows) {
        expect(row.lastName as string).not.toMatch(/GF_Admin|GF_Emp|GF_Mgr/i);
      }
    });

    it('401 sans session (guards RBAC intacts)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/lab/employees/search?q=test');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------
  // LAB_MODE=false : blocage
  // -------------------------------------------------------
  describe('LAB_MODE=false (production)', () => {
    let app: NestExpressApplication;
    let cookie: string;

    beforeAll(async () => {
      app = await createTestApp();
      cookie = await sessionCookie(app, CREDENTIALS.admin);
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/lab/employees/search -> 404 (route absente)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/lab/employees/search?q=test')
        .set('Cookie', cookie);
      expect(res.status).toBe(404);
    });

    it('GET /api/v1/employees/search -> 400 (ParseUUIDPipe sur :id)', async () => {
      // En production, /employees/search correspond a @Get(':id') avec id='search'
      // ParseUUIDPipe rejette 'search' -> 400, pas d'injection possible
      const res = await request(app.getHttpServer())
        .get('/api/v1/employees/search?q=test')
        .set('Cookie', cookie);
      expect(res.status).toBe(400);
    });
  });
});
