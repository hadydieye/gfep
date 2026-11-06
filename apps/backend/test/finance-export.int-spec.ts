import type { NestExpressApplication } from '@nestjs/platform-express';
import { Prisma, type PrismaClient } from '@prisma/client';
import request from 'supertest';
import { CREDENTIALS, createTestApp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 3.1 — Export CSV finance (gfep-mvp3 R4, N5) : matrice des 8 rôles,
 * scope DM, filtres et tri, format (BOM, `;`, CRLF, virgule décimale),
 * neutralisation des formules, plafond de 10 000 lignes, audit sans données.
 */
type Role = keyof typeof CREDENTIALS;
const ROLES = Object.keys(CREDENTIALS) as Role[];
const ALLOWED: Role[] = ['admin', 'accountant', 'manager'];
const BOM = '﻿';

/** Corps brut (texte) d'une réponse CSV. */
function csvText(response: request.Response): string {
  return Buffer.isBuffer(response.body) ? response.body.toString('utf8') : response.text;
}

function csvLines(response: request.Response): string[] {
  const text = csvText(response);
  expect(text.startsWith(BOM)).toBe(true);
  expect(text.endsWith('\r\n')).toBe(true);
  return text.slice(1, -2).split('\r\n');
}

describe('Export CSV finance (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  const sessions = {} as Record<Role, string>;
  let managerDepartmentId: string;

  const exportCsv = (path: string, cookie?: string) => {
    const req = request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    return cookie ? req.set('Cookie', cookie) : req;
  };

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    for (const role of ROLES) sessions[role] = await sessionCookie(app, CREDENTIALS[role]);
    const manager = await prisma.user.findUniqueOrThrow({
      where: { username: CREDENTIALS.manager.username },
      include: { employeeIdentity: { include: { employee: true } } },
    });
    managerDepartmentId = manager.employeeIdentity!.employee.departmentId;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('matrice des 8 rôles et 401 sans session, sur les deux exports', async () => {
    for (const path of ['/transactions/export', '/invoices/export']) {
      expect((await exportCsv(path)).status).toBe(401);
      for (const role of ROLES) {
        const response = await exportCsv(path, sessions[role]);
        expect({ role, path, status: response.status }).toEqual({
          role,
          path,
          status: ALLOWED.includes(role) ? 200 : 403,
        });
      }
    }
  });

  it('en-têtes de réponse : CSV, pièce jointe, nosniff, no-store', async () => {
    const response = await exportCsv('/transactions/export', sessions.admin);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toMatch(/^attachment; filename="transactions-\d{8}\.csv"$/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['cache-control']).toBe('no-store');
    const invoices = await exportCsv('/invoices/export', sessions.admin);
    expect(invoices.headers['content-disposition']).toMatch(/^attachment; filename="factures-\d{8}\.csv"$/);
  });

  it('transactions : toutes les lignes, colonnes françaises, montants à virgule, dates ISO', async () => {
    const lines = csvLines(await exportCsv('/transactions/export', sessions.admin));
    expect(lines[0]).toBe('Référence;Type;Montant;Devise;Statut;Département;Description;Créée le');
    expect(lines).toHaveLength(1 + (await prisma.transaction.count()));
    const first = await prisma.transaction.findFirstOrThrow({
      orderBy: [{ createdAt: 'desc' }, { reference: 'desc' }],
      include: { department: true },
    });
    const cells = lines[1].split(';');
    expect(cells[0]).toBe(first.reference);
    expect(cells[1]).toBe(first.transactionType === 'INCOME' ? 'Recette' : 'Dépense');
    expect(cells[2]).toBe(first.amount.toFixed(2).replace('.', ','));
    expect(cells[2]).toMatch(/^\d+,\d{2}$/);
    expect(cells[7]).toBe(first.createdAt.toISOString().slice(0, 10));
  });

  it('factures : filtres et tri de la liste appliqués', async () => {
    const lines = csvLines(await exportCsv('/invoices/export?status=PAID&sort=amount&order=asc', sessions.accountant));
    expect(lines[0]).toBe('Numéro;Client;Montant;Devise;Échéance;Statut;Département;Créée le');
    const expected = await prisma.invoice.findMany({
      where: { status: 'PAID' },
      orderBy: [{ amount: 'asc' }, { invoiceNumber: 'asc' }],
    });
    expect(lines.slice(1).map((line) => line.split(';')[0])).toEqual(expected.map((i) => i.invoiceNumber));
    for (const line of lines.slice(1)) expect(line.split(';')[5]).toBe('Payée');
  });

  it('scope DM : uniquement les lignes de son département, même avec un autre filtre de département', async () => {
    const other = await prisma.department.findFirstOrThrow({ where: { id: { not: managerDepartmentId } } });
    const own = csvLines(await exportCsv('/transactions/export', sessions.manager));
    expect(own).toHaveLength(1 + (await prisma.transaction.count({ where: { departmentId: managerDepartmentId } })));
    const forced = csvLines(await exportCsv(`/invoices/export?departmentId=${other.id}`, sessions.manager));
    expect(forced).toHaveLength(1);
  });

  it('neutralise une formule et échappe le séparateur', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: CREDENTIALS.admin.username } });
    await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-CSV-0001',
        clientName: '=HYPERLINK("http://example.test";"x")',
        amount: new Prisma.Decimal('12.50'),
        dueDate: new Date('2026-12-01T00:00:00Z'),
        createdBy: admin.id,
        departmentId: managerDepartmentId,
      },
    });
    const text = csvText(await exportCsv('/invoices/export?search=HYPERLINK', sessions.admin));
    const row = text.slice(1).split('\r\n')[1];
    expect(row.startsWith(`INV-CSV-0001;"'=HYPERLINK(""http://example.test"";""x"")";12,50;GNF;2026-12-01;`)).toBe(true);
  });

  it('validation : pagination et clé de tri inconnue refusées (400 générique)', async () => {
    for (const path of ['/transactions/export?page=2', '/invoices/export?limit=10', '/invoices/export?sort=clientEmail']) {
      const response = await request(app.getHttpServer()).get(`/api/v1${path}`).set('Cookie', sessions.admin);
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Données invalides.');
    }
  });

  it('audit : filtres et nombre de lignes, aucune donnée exportée', async () => {
    await prisma.auditLog.deleteMany({ where: { action: { in: ['transaction.export', 'invoice.export'] } } });
    await exportCsv('/transactions/export?type=INCOME&sort=amount&order=desc', sessions.accountant);
    const accountant = await prisma.user.findUniqueOrThrow({ where: { username: CREDENTIALS.accountant.username } });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'transaction.export' } });
    expect(log).toMatchObject({ actorId: accountant.id, resourceType: 'Transaction', resourceId: 'export' });
    expect(log.newValues).toEqual({
      exportFilters: { type: 'INCOME', sort: 'amount', order: 'desc' },
      exportedRows: await prisma.transaction.count({ where: { transactionType: 'INCOME' } }),
    });
    expect(JSON.stringify(log.newValues)).not.toMatch(/TRX-/);

    await exportCsv('/invoices/export', sessions.manager);
    expect(await prisma.auditLog.count({ where: { action: 'invoice.export' } })).toBe(1);
    // Un export refusé (403) n'écrit rien
    await exportCsv('/invoices/export', sessions.employee);
    expect(await prisma.auditLog.count({ where: { action: 'invoice.export' } })).toBe(1);
  });

  it('plafond : au-delà de 10 000 lignes, 400 avec message actionnable', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: CREDENTIALS.admin.username } });
    const existing = await prisma.transaction.count();
    await prisma.transaction.createMany({
      data: Array.from({ length: 10_001 - existing }, (_, index) => ({
        reference: `TRX-BULK-${String(index).padStart(5, '0')}`,
        transactionType: 'EXPENSE' as const,
        amount: new Prisma.Decimal('1.00'),
        createdBy: admin.id,
        departmentId: managerDepartmentId,
      })),
    });
    const response = await request(app.getHttpServer()).get('/api/v1/transactions/export').set('Cookie', sessions.admin);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("L'export dépasse 10 000 lignes. Affinez les filtres.");
    // Un filtre ramène l'export sous le plafond
    const filtered = await exportCsv('/transactions/export?search=TRX-BULK-0000', sessions.admin);
    expect(filtered.status).toBe(200);
  });
});
