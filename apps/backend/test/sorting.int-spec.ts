import type { NestExpressApplication } from '@nestjs/platform-express';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { ACCOUNT_SORTS, ACCOUNT_SORT_TIEBREAKER } from '../src/access/account-sorting.js';
import {
  AUDIT_LOG_SORTS,
  AUDIT_SORT_TIEBREAKER,
  AUTH_EVENT_SORTS,
  SECURITY_EVENT_SORTS,
} from '../src/audit/audit-sorting.js';
import { DOCUMENT_SORTS } from '../src/documents/document-sorting.js';
import { EMPLOYEE_SORTS, EMPLOYEE_SORT_TIEBREAKER } from '../src/employees/employee-sorting.js';
import {
  INVOICE_SORTS,
  INVOICE_SORT_TIEBREAKER,
  TRANSACTION_SORTS,
  TRANSACTION_SORT_TIEBREAKER,
} from '../src/finance/finance-sorting.js';
import { CREDENTIALS, createTestApp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 3.1 — Tri par colonne côté serveur (gfep-mvp3 R3, N6).
 *
 * Pour chaque endpoint et chaque clé : l'ordre renvoyé par l'API est celui de
 * la base pour la même liste blanche (asc et desc) ; une clé ou un ordre hors
 * liste → 400 générique ; sans `sort`, l'ordre par défaut est inchangé ; le
 * scope DM et la visibilité M9 restent appliqués.
 */
type Role = 'admin' | 'manager' | 'employee';

const INVALID = { statusCode: 400, error: 'Bad Request', message: 'Données invalides.' };

describe('Tri par colonne (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: Record<Role, string>;

  const get = (path: string, cookie: string) => request(app.getHttpServer()).get(`/api/v1${path}`).set('Cookie', cookie);
  const ids = (body: { data: Array<{ id: string }> }) => body.data.map((row) => row.id);

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = {
      admin: await sessionCookie(app, CREDENTIALS.admin),
      manager: await sessionCookie(app, CREDENTIALS.manager),
      employee: await sessionCookie(app, CREDENTIALS.employee),
    };
    // Quelques entrées d'audit et d'authentification à trier
    await get('/employees?limit=1', sessions.admin);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('employés : chaque clé, asc et desc, suit l’ordre de la base', async () => {
    for (const [key, build] of Object.entries(EMPLOYEE_SORTS)) {
      for (const order of ['asc', 'desc'] as const) {
        const response = await get(`/employees?limit=100&sort=${key}&order=${order}`, sessions.admin);
        expect(response.status).toBe(200);
        const expected = await prisma.employee.findMany({
          orderBy: [...build(order), ...EMPLOYEE_SORT_TIEBREAKER],
          select: { id: true },
        });
        expect(ids(response.body)).toEqual(expected.map((e) => e.id));
      }
    }
  });

  it('employés : ordre sémantique sur les dates d’embauche', async () => {
    const response = await get('/employees?limit=100&sort=hireDate&order=desc', sessions.admin);
    const dates = response.body.data.map((e: { hireDate: string }) => Date.parse(e.hireDate));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('documents : chaque clé suit l’ordre de la base, M9 conservée pour un EMPLOYEE', async () => {
    const unsorted = await get('/documents?limit=100', sessions.employee);
    const visible = new Set(ids(unsorted.body));
    for (const [key, build] of Object.entries(DOCUMENT_SORTS)) {
      for (const order of ['asc', 'desc'] as const) {
        const response = await get(`/documents?limit=100&sort=${key}&order=${order}`, sessions.employee);
        expect(response.status).toBe(200);
        // Même ensemble visible, quel que soit le tri
        expect(new Set(ids(response.body))).toEqual(visible);
        const expected = await prisma.document.findMany({
          where: { id: { in: [...visible] } },
          orderBy: [...build(order), { id: 'asc' }],
          select: { id: true },
        });
        expect(ids(response.body)).toEqual(expected.map((d) => d.id));
      }
    }
  });

  it('transactions : chaque clé suit l’ordre de la base ; montants triés numériquement', async () => {
    for (const [key, build] of Object.entries(TRANSACTION_SORTS)) {
      for (const order of ['asc', 'desc'] as const) {
        const response = await get(`/transactions?limit=100&sort=${key}&order=${order}`, sessions.admin);
        expect(response.status).toBe(200);
        const expected = await prisma.transaction.findMany({
          orderBy: [...build(order), ...TRANSACTION_SORT_TIEBREAKER],
          select: { id: true },
          take: 100,
        });
        expect(ids(response.body)).toEqual(expected.map((t) => t.id));
      }
    }
    const byAmount = await get('/transactions?limit=100&sort=amount&order=asc', sessions.admin);
    const amounts = byAmount.body.data.map((t: { amount: string }) => Number(t.amount));
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it('transactions : le scope DM reste appliqué avec un tri', async () => {
    const manager = await prisma.user.findUniqueOrThrow({
      where: { username: CREDENTIALS.manager.username },
      include: { employeeIdentity: { include: { employee: true } } },
    });
    const departmentId = manager.employeeIdentity!.employee.departmentId;
    const response = await get('/transactions?limit=100&sort=amount&order=desc', sessions.manager);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(await prisma.transaction.count({ where: { departmentId } }));
    for (const row of response.body.data) expect(row.department.id).toBe(departmentId);
  });

  it('factures : chaque clé suit l’ordre de la base', async () => {
    for (const [key, build] of Object.entries(INVOICE_SORTS)) {
      for (const order of ['asc', 'desc'] as const) {
        const response = await get(`/invoices?limit=100&sort=${key}&order=${order}`, sessions.admin);
        expect(response.status).toBe(200);
        const expected = await prisma.invoice.findMany({
          orderBy: [...build(order), ...INVOICE_SORT_TIEBREAKER],
          select: { id: true },
        });
        expect(ids(response.body)).toEqual(expected.map((i) => i.id));
      }
    }
  });

  it('comptes : chaque clé suit l’ordre de la base', async () => {
    for (const [key, build] of Object.entries(ACCOUNT_SORTS)) {
      for (const order of ['asc', 'desc'] as const) {
        const response = await get(`/access/users?limit=100&sort=${key}&order=${order}`, sessions.admin);
        expect(response.status).toBe(200);
        const expected = await prisma.user.findMany({
          orderBy: [...build(order), ...ACCOUNT_SORT_TIEBREAKER],
          select: { id: true },
          take: 100,
        });
        expect(ids(response.body)).toEqual(expected.map((u) => u.id));
      }
    }
  });

  it('journaux : chaque clé des trois listes suit l’ordre de la base', async () => {
    for (const [key, build] of Object.entries(AUDIT_LOG_SORTS)) {
      const response = await get(`/audit/logs?limit=100&sort=${key}&order=desc`, sessions.admin);
      expect(response.status).toBe(200);
      const expected = await prisma.auditLog.findMany({
        orderBy: [...build('desc'), ...AUDIT_SORT_TIEBREAKER],
        select: { id: true },
        take: 100,
      });
      expect(ids(response.body)).toEqual(expected.map((row) => row.id));
    }
    for (const [key, build] of Object.entries(SECURITY_EVENT_SORTS)) {
      const response = await get(`/audit/security-events?limit=100&sort=${key}&order=asc`, sessions.admin);
      expect(response.status).toBe(200);
      const expected = await prisma.securityEvent.findMany({
        orderBy: [...build('asc'), ...AUDIT_SORT_TIEBREAKER],
        select: { id: true },
        take: 100,
      });
      expect(ids(response.body)).toEqual(expected.map((row) => row.id));
    }
    for (const [key, build] of Object.entries(AUTH_EVENT_SORTS)) {
      const response = await get(`/audit/auth-events?limit=100&sort=${key}&order=asc`, sessions.admin);
      expect(response.status).toBe(200);
      const expected = await prisma.authEvent.findMany({
        orderBy: [...build('asc'), ...AUDIT_SORT_TIEBREAKER],
        select: { id: true },
        take: 100,
      });
      expect(ids(response.body)).toEqual(expected.map((row) => row.id));
    }
  });

  it('sans `sort`, l’ordre par défaut est inchangé', async () => {
    const employees = await get('/employees?limit=100', sessions.admin);
    const expectedEmployees = await prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true },
    });
    expect(ids(employees.body)).toEqual(expectedEmployees.map((e) => e.id));

    const invoices = await get('/invoices?limit=100', sessions.admin);
    const expectedInvoices = await prisma.invoice.findMany({
      orderBy: [{ dueDate: 'desc' }, { invoiceNumber: 'desc' }],
      select: { id: true },
    });
    expect(ids(invoices.body)).toEqual(expectedInvoices.map((i) => i.id));
  });

  it('clé ou ordre hors liste blanche → 400 générique, sans nommer la valeur', async () => {
    const cases = [
      '/employees?sort=passwordHash',
      '/employees?sort=toString',
      '/employees?sort=lastName&order=sideways',
      '/documents?sort=storagePath',
      '/transactions?sort=createdBy',
      '/invoices?sort=__proto__',
      '/access/users?sort=passwordHash',
      '/audit/logs?sort=oldValues',
      '/audit/security-events?sort=metadata',
      '/audit/auth-events?sort=sourceIp',
    ];
    for (const path of cases) {
      const response = await get(path, sessions.admin);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(INVALID.message);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|storagePath|createdBy|oldValues|metadata|sourceIp|sideways/);
    }
  });
});
