import type { NestExpressApplication } from '@nestjs/platform-express';
import { InvoiceStatus, PrismaClient, TransactionStatus, TransactionType } from '@prisma/client';
import request from 'supertest';
import { CREDENTIALS, createTestApp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Étape 2.3 — Finance (gfep-mvp2 R11–R15, M13, M14). Comptes du seed complet :
 * SUPER_ADMIN m.keita, ACCOUNTANT ibrahima.sow, DEPARTMENT_MANAGER f.camara (RH),
 * EMPLOYEE m.diallo (CF).
 */
type Role = 'admin' | 'accountant' | 'manager' | 'employee';

const ACCOUNTANT = { username: 'ibrahima.sow', password: 'GF_Acc2026!' };
const NON_EXISTENT_ID = '00000000-0000-4000-8000-000000000000';
const AMOUNT_STRING = /^\d+\.\d{2}$/;
const STATE_CONFLICT = "Cette action n'est pas possible dans l'état actuel.";
const FORBIDDEN_TRANSITION = "Ce changement de statut n'est pas autorisé pour cette facture.";

const ALLOWED_TRANSITIONS: Array<[InvoiceStatus, InvoiceStatus]> = [
  ['DRAFT', 'SENT'],
  ['DRAFT', 'CANCELLED'],
  ['SENT', 'PAID'],
  ['SENT', 'OVERDUE'],
  ['SENT', 'CANCELLED'],
  ['OVERDUE', 'PAID'],
  ['OVERDUE', 'CANCELLED'],
];
const FORBIDDEN_TRANSITIONS = Object.values(InvoiceStatus)
  .flatMap((from) => Object.values(InvoiceStatus).map((to) => [from, to] as [InvoiceStatus, InvoiceStatus]))
  .filter(([from, to]) => !ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to));

let fixtureCounter = 0;

describe('Finance (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: Record<Role, string>;
  let departmentIds: Map<string, string>;
  let adminId: string;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = {
      admin: await sessionCookie(app, CREDENTIALS.admin),
      accountant: await sessionCookie(app, ACCOUNTANT),
      manager: await sessionCookie(app, CREDENTIALS.manager),
      employee: await sessionCookie(app, CREDENTIALS.employee),
    };
    const departments = await prisma.department.findMany();
    departmentIds = new Map(departments.map((d) => [d.code, d.id]));
    adminId = (await prisma.user.findUniqueOrThrow({ where: { username: 'm.keita' } })).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const url = (path: string) => `/api/v1${path}`;
  const call = (method: 'GET' | 'POST' | 'PATCH', path: string, cookie?: string, body?: object) => {
    const server = request(app.getHttpServer());
    let req = method === 'GET' ? server.get(url(path)) : method === 'POST' ? server.post(url(path)) : server.patch(url(path));
    if (cookie) req = req.set('Cookie', cookie);
    return body ? req.send(body) : req;
  };
  const dep = (code: string) => departmentIds.get(code)!;

  const makeTransaction = (departmentCode: string | null, status: TransactionStatus = TransactionStatus.PENDING) => {
    fixtureCounter += 1;
    return prisma.transaction.create({
      data: {
        reference: `TRX-TEST-${String(fixtureCounter).padStart(5, '0')}`,
        transactionType: TransactionType.EXPENSE,
        amount: '1234.56',
        description: 'Transaction de test',
        status,
        createdBy: adminId,
        departmentId: departmentCode ? dep(departmentCode) : null,
      },
    });
  };
  const makeInvoice = (departmentCode: string | null, status: InvoiceStatus = InvoiceStatus.SENT) => {
    fixtureCounter += 1;
    return prisma.invoice.create({
      data: {
        invoiceNumber: `FAC-TEST-${String(fixtureCounter).padStart(4, '0')}`,
        clientName: 'Client de test SARL',
        amount: '987654.32',
        dueDate: new Date('2026-12-31T00:00:00.000Z'),
        status,
        createdBy: adminId,
        departmentId: departmentCode ? dep(departmentCode) : null,
      },
    });
  };
  const validBody = () => ({ transactionType: 'INCOME', amount: '1500.50', description: 'Test', departmentId: dep('CF') });

  describe('matrice des rôles par route (R15)', () => {
    const readCases: Array<[Role, number]> = [
      ['admin', 200],
      ['accountant', 200],
      ['manager', 200],
      ['employee', 403],
    ];

    it.each(readCases)('GET /transactions : %s → %i', async (role, status) => {
      expect((await call('GET', '/transactions', sessions[role])).status).toBe(status);
    });

    it.each(readCases)('GET /invoices : %s → %i', async (role, status) => {
      expect((await call('GET', '/invoices', sessions[role])).status).toBe(status);
    });

    it.each(readCases)('GET /invoices/:id (facture RH) : %s → %i', async (role, status) => {
      const invoice = await makeInvoice('RH');
      expect((await call('GET', `/invoices/${invoice.id}`, sessions[role])).status).toBe(status);
    });

    it.each<[Role, number]>([
      ['admin', 201],
      ['accountant', 201],
      ['manager', 403],
      ['employee', 403],
    ])('POST /transactions : %s → %i', async (role, status) => {
      expect((await call('POST', '/transactions', sessions[role], validBody())).status).toBe(status);
    });

    it.each<[Role, number]>([
      ['admin', 200],
      ['accountant', 403],
      ['manager', 403],
      ['employee', 403],
    ])('PATCH /transactions/:id/status : %s → %i', async (role, status) => {
      const transaction = await makeTransaction('RH');
      const response = await call('PATCH', `/transactions/${transaction.id}/status`, sessions[role], {
        status: 'VALIDATED',
      });
      expect(response.status).toBe(status);
    });

    it.each<[Role, number]>([
      ['admin', 200],
      ['accountant', 200],
      ['manager', 403],
      ['employee', 403],
    ])('PATCH /invoices/:id/status : %s → %i', async (role, status) => {
      const invoice = await makeInvoice('RH', InvoiceStatus.SENT);
      const response = await call('PATCH', `/invoices/${invoice.id}/status`, sessions[role], { status: 'PAID' });
      expect(response.status).toBe(status);
    });

    it('sans session : 401 sur chaque route finance', async () => {
      const invoice = await makeInvoice('RH');
      const transaction = await makeTransaction('RH');
      const responses = await Promise.all([
        call('GET', '/transactions'),
        call('POST', '/transactions', undefined, validBody()),
        call('PATCH', `/transactions/${transaction.id}/status`, undefined, { status: 'VALIDATED' }),
        call('GET', '/invoices'),
        call('GET', `/invoices/${invoice.id}`),
        call('PATCH', `/invoices/${invoice.id}/status`, undefined, { status: 'PAID' }),
      ]);
      expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
    });

    it('un refus ne modifie rien : EMPLOYEE et DM ne créent ni ne changent aucun statut', async () => {
      const before = await prisma.transaction.count();
      const invoice = await makeInvoice('RH', InvoiceStatus.SENT);
      await call('POST', '/transactions', sessions.employee, validBody());
      await call('POST', '/transactions', sessions.manager, validBody());
      await call('PATCH', `/invoices/${invoice.id}/status`, sessions.manager, { status: 'PAID' });
      expect(await prisma.transaction.count()).toBe(before);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe('SENT');
    });
  });

  describe('ACCOUNTANT hors finance (matrice design §2)', () => {
    it('lecture du dashboard, des employés, des départements et des documents ; aucune écriture employé ni validation', async () => {
      for (const path of ['/dashboard', '/employees', '/departments', '/documents']) {
        expect((await call('GET', path, sessions.accountant)).status, path).toBe(200);
      }
      expect((await call('POST', '/employees', sessions.accountant, {})).status).toBe(403);
      const document = await prisma.document.findFirstOrThrow();
      expect(
        (await call('PATCH', `/documents/${document.id}/validation`, sessions.accountant, { status: 'VALIDATED' })).status,
      ).toBe(403);
    });
  });

  describe('scope du DEPARTMENT_MANAGER (M13)', () => {
    it('transactions : uniquement celles de son département, jamais celles sans département', async () => {
      const own = await makeTransaction('RH');
      const other = await makeTransaction('CF');
      const orphan = await makeTransaction(null);

      const response = await call('GET', '/transactions?limit=100', sessions.manager);
      expect(response.status).toBe(200);
      const expected = await prisma.transaction.count({ where: { departmentId: dep('RH') } });
      expect(response.body.total).toBe(expected);
      expect(response.body.data.every((t: { department: { code: string } }) => t.department.code === 'RH')).toBe(true);
      const ids = response.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(own.id);
      expect(ids).not.toContain(other.id);
      expect(ids).not.toContain(orphan.id);
    });

    it('transactions : un filtre sur un autre département ne contourne pas le scope', async () => {
      const response = await call('GET', `/transactions?departmentId=${dep('CF')}`, sessions.manager);
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });

    it('factures : liste limitée à son département', async () => {
      const orphan = await makeInvoice(null);
      const response = await call('GET', '/invoices?limit=100', sessions.manager);
      expect(response.status).toBe(200);
      expect(response.body.total).toBe(await prisma.invoice.count({ where: { departmentId: dep('RH') } }));
      expect(response.body.data.every((i: { department: { code: string } }) => i.department.code === 'RH')).toBe(true);
      expect(response.body.data.map((i: { id: string }) => i.id)).not.toContain(orphan.id);
    });

    it('factures : détail hors département ou sans département → 404, comme une facture inexistante', async () => {
      const other = await makeInvoice('CF');
      const orphan = await makeInvoice(null);
      for (const id of [other.id, orphan.id, NON_EXISTENT_ID]) {
        const response = await call('GET', `/invoices/${id}`, sessions.manager);
        expect(response.status).toBe(404);
      }
    });

    it('factures : le DM ne reçoit aucune transition proposée (lecture seule)', async () => {
      const invoice = await makeInvoice('RH', InvoiceStatus.SENT);
      const response = await call('GET', `/invoices/${invoice.id}`, sessions.manager);
      expect(response.body.allowedTransitions).toEqual([]);
    });

    it('ACCOUNTANT et SUPER_ADMIN voient tout, y compris les lignes sans département', async () => {
      const orphanTransaction = await makeTransaction(null);
      const orphanInvoice = await makeInvoice(null);
      for (const role of ['accountant', 'admin'] as const) {
        const transactions = await call('GET', '/transactions?limit=100', sessions[role]);
        expect(transactions.body.total).toBe(await prisma.transaction.count());
        const invoices = await call('GET', '/invoices?limit=100', sessions[role]);
        expect(invoices.body.total).toBe(await prisma.invoice.count());
        expect((await call('GET', `/invoices/${orphanInvoice.id}`, sessions[role])).status).toBe(200);
      }
      const search = await call('GET', `/transactions?search=${orphanTransaction.reference}`, sessions.accountant);
      expect(search.body.data.map((t: { id: string }) => t.id)).toEqual([orphanTransaction.id]);
    });
  });

  describe('création de transaction (R12.3)', () => {
    it('ACCOUNTANT : référence TRX-AAAA-NNNNN, PENDING, montant en chaîne, créateur', async () => {
      const response = await call('POST', '/transactions', sessions.accountant, validBody());
      expect(response.status).toBe(201);
      const year = new Date().getFullYear();
      expect(response.body.reference).toMatch(new RegExp(`^TRX-${year}-\\d{5}$`));
      expect(response.body).toMatchObject({
        transactionType: 'INCOME',
        amount: '1500.50',
        currency: 'GNF',
        description: 'Test',
        status: 'PENDING',
        department: { code: 'CF' },
        createdBy: { username: 'ibrahima.sow' },
      });
      const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: response.body.id } });
      expect(stored.amount.toFixed(2)).toBe('1500.50');
      expect(stored.departmentId).toBe(dep('CF'));
    });

    it('la référence suit le plus grand numéro de l’année', async () => {
      const year = new Date().getFullYear();
      const prefix = `TRX-${year}-`;
      const existing = await prisma.transaction.findMany({
        where: { reference: { startsWith: prefix } },
        select: { reference: true },
      });
      const max = Math.max(0, ...existing.map((t) => Number(t.reference.slice(prefix.length))));
      const response = await call('POST', '/transactions', sessions.admin, validBody());
      expect(response.body.reference).toBe(`${prefix}${String(max + 1).padStart(5, '0')}`);
    });

    it('créations simultanées : références toutes distinctes et consécutives', async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => call('POST', '/transactions', sessions.accountant, validBody())),
      );
      expect(responses.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
      const references = responses.map((r) => r.body.reference as string).sort();
      expect(new Set(references).size).toBe(5);
      const numbers = references.map((r) => Number(r.slice(-5)));
      expect(numbers[4] - numbers[0]).toBe(4);
    });

    it.each([
      ['montant numérique (flottant)', { amount: 1500.5 }],
      ['montant nul', { amount: '0.00' }],
      ['montant négatif', { amount: '-10' }],
      ['trois décimales', { amount: '10.123' }],
      ['montant au-delà de Decimal(14,2)', { amount: '1000000000000' }],
      ['type inconnu', { transactionType: 'TRANSFER' }],
      ['département non UUID', { departmentId: 'RH' }],
      ['description trop longue', { description: 'x'.repeat(501) }],
    ])('400 générique : %s', async (_label, override) => {
      const response = await call('POST', '/transactions', sessions.accountant, { ...validBody(), ...override });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Données invalides.');
    });

    it('400 générique sans nommer un champ non déclaré', async () => {
      const response = await call('POST', '/transactions', sessions.accountant, {
        ...validBody(),
        status: 'VALIDATED',
      });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ statusCode: 400, error: 'Bad Request', message: 'Données invalides.' });
    });

    it('département obligatoire et existant', async () => {
      const { departmentId: _omitted, ...withoutDepartment } = validBody();
      expect((await call('POST', '/transactions', sessions.accountant, withoutDepartment)).status).toBe(400);
      const unknown = await call('POST', '/transactions', sessions.accountant, {
        ...validBody(),
        departmentId: NON_EXISTENT_ID,
      });
      expect(unknown.status).toBe(400);
      expect(unknown.body.message).toBe('Département inexistant.');
    });
  });

  describe('validation des transactions (R12.4)', () => {
    it('SUPER_ADMIN valide puis ne peut plus décider (409)', async () => {
      const transaction = await makeTransaction('IT');
      const first = await call('PATCH', `/transactions/${transaction.id}/status`, sessions.admin, { status: 'VALIDATED' });
      expect(first.status).toBe(200);
      expect(first.body.status).toBe('VALIDATED');
      const second = await call('PATCH', `/transactions/${transaction.id}/status`, sessions.admin, { status: 'REJECTED' });
      expect(second.status).toBe(409);
      expect(second.body.message).toBe(STATE_CONFLICT);
      expect((await prisma.transaction.findUniqueOrThrow({ where: { id: transaction.id } })).status).toBe('VALIDATED');
    });

    it('SUPER_ADMIN rejette une transaction PENDING', async () => {
      const transaction = await makeTransaction('IT');
      const response = await call('PATCH', `/transactions/${transaction.id}/status`, sessions.admin, { status: 'REJECTED' });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REJECTED');
    });

    it('409 depuis REJECTED ; 400 pour un statut cible PENDING ; 404 si inexistante', async () => {
      const rejected = await makeTransaction('IT', TransactionStatus.REJECTED);
      expect(
        (await call('PATCH', `/transactions/${rejected.id}/status`, sessions.admin, { status: 'VALIDATED' })).status,
      ).toBe(409);
      const pending = await makeTransaction('IT');
      expect(
        (await call('PATCH', `/transactions/${pending.id}/status`, sessions.admin, { status: 'PENDING' })).status,
      ).toBe(400);
      expect(
        (await call('PATCH', `/transactions/${NON_EXISTENT_ID}/status`, sessions.admin, { status: 'VALIDATED' })).status,
      ).toBe(404);
    });

    it('décisions simultanées : une seule aboutit', async () => {
      const transaction = await makeTransaction('IT');
      const responses = await Promise.all(
        (['VALIDATED', 'REJECTED', 'VALIDATED'] as const).map((status) =>
          call('PATCH', `/transactions/${transaction.id}/status`, sessions.admin, { status }),
        ),
      );
      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409, 409]);
      expect(await prisma.auditLog.count({ where: { resourceId: transaction.id } })).toBe(1);
    });
  });

  describe('transitions de facture (M14, R13.2)', () => {
    it.each(ALLOWED_TRANSITIONS)('autorisée : %s → %s', async (from, to) => {
      const invoice = await makeInvoice('CO', from);
      const response = await call('PATCH', `/invoices/${invoice.id}/status`, sessions.accountant, { status: to });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(to);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe(to);
    });

    it('exactement 18 transitions interdites sont testées', () => {
      expect(FORBIDDEN_TRANSITIONS).toHaveLength(18);
    });

    it.each(FORBIDDEN_TRANSITIONS)('interdite : %s → %s renvoie 400, statut inchangé, aucun audit', async (from, to) => {
      const invoice = await makeInvoice('CO', from);
      const response = await call('PATCH', `/invoices/${invoice.id}/status`, sessions.accountant, { status: to });
      expect(response.status).toBe(400);
      expect(response.body.message).toBe(FORBIDDEN_TRANSITION);
      expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe(from);
      expect(await prisma.auditLog.count({ where: { resourceId: invoice.id } })).toBe(0);
    });

    it('statut inconnu → 400 générique ; facture inexistante → 404', async () => {
      const invoice = await makeInvoice('CO', InvoiceStatus.SENT);
      const unknown = await call('PATCH', `/invoices/${invoice.id}/status`, sessions.accountant, { status: 'ARCHIVED' });
      expect(unknown.status).toBe(400);
      expect(unknown.body.message).toBe('Données invalides.');
      expect(
        (await call('PATCH', `/invoices/${NON_EXISTENT_ID}/status`, sessions.accountant, { status: 'PAID' })).status,
      ).toBe(404);
    });

    it('le détail propose à l’ACCOUNTANT les seules transitions autorisées', async () => {
      const invoice = await makeInvoice('CO', InvoiceStatus.SENT);
      const response = await call('GET', `/invoices/${invoice.id}`, sessions.accountant);
      expect(response.body.allowedTransitions).toEqual(['PAID', 'OVERDUE', 'CANCELLED']);
    });
  });

  describe('montants en chaîne (R12.5)', () => {
    it('transactions et factures : montant en chaîne à 2 décimales, devise GNF, identique à la base', async () => {
      const transactions = await call('GET', '/transactions?limit=100', sessions.accountant);
      const invoices = await call('GET', '/invoices?limit=100', sessions.accountant);
      for (const row of [...transactions.body.data, ...invoices.body.data]) {
        expect(typeof row.amount).toBe('string');
        expect(row.amount).toMatch(AMOUNT_STRING);
        expect(row.currency).toBe('GNF');
      }
      const sample = await prisma.transaction.findFirstOrThrow({ where: { reference: 'TRX-2026-00002' } });
      const listed = transactions.body.data.find((t: { id: string }) => t.id === sample.id)
        ?? (await call('GET', '/transactions?search=TRX-2026-00002', sessions.accountant)).body.data[0];
      expect(listed.amount).toBe(sample.amount.toFixed(2));
    });
  });

  describe('filtres et pagination (R12.1, R13.1)', () => {
    it('transactions : type, statut, période et pagination', async () => {
      const income = await call('GET', '/transactions?type=INCOME&limit=100', sessions.accountant);
      expect(income.body.data.every((t: { transactionType: string }) => t.transactionType === 'INCOME')).toBe(true);
      expect(income.body.total).toBe(await prisma.transaction.count({ where: { transactionType: 'INCOME' } }));

      const pending = await call('GET', '/transactions?status=PENDING', sessions.accountant);
      expect(pending.body.total).toBe(await prisma.transaction.count({ where: { status: 'PENDING' } }));

      const march = await call('GET', '/transactions?from=2026-03-01&to=2026-03-31&limit=100', sessions.accountant);
      const expected = await prisma.transaction.count({
        where: { createdAt: { gte: new Date('2026-03-01T00:00:00Z'), lt: new Date('2026-04-01T00:00:00Z') } },
      });
      expect(expected).toBeGreaterThan(0);
      expect(march.body.total).toBe(expected);

      const page = await call('GET', '/transactions?page=2&limit=10', sessions.accountant);
      expect(page.body).toMatchObject({ page: 2, limit: 10 });
      expect(page.body.data).toHaveLength(10);
      expect((await call('GET', '/transactions?limit=101', sessions.accountant)).status).toBe(400);
      expect((await call('GET', '/transactions?from=31-03-2026', sessions.accountant)).status).toBe(400);
    });

    it('factures : statut, client et échéance', async () => {
      const sent = await call('GET', '/invoices?status=SENT&limit=100', sessions.accountant);
      expect(sent.body.total).toBe(await prisma.invoice.count({ where: { status: 'SENT' } }));

      const client = await call('GET', '/invoices?search=kaloum', sessions.accountant);
      expect(client.body.total).toBe(
        await prisma.invoice.count({ where: { clientName: { contains: 'Kaloum', mode: 'insensitive' } } }),
      );
      expect(client.body.total).toBeGreaterThan(0);

      const due = await call('GET', '/invoices?dueFrom=2026-05-01&dueTo=2026-05-31', sessions.accountant);
      expect(due.body.total).toBe(
        await prisma.invoice.count({
          where: { dueDate: { gte: new Date('2026-05-01T00:00:00Z'), lt: new Date('2026-06-01T00:00:00Z') } },
        }),
      );
    });
  });

  describe('dashboard ACCOUNTANT (R14.3)', () => {
    it('transactions récentes, factures en attente et indicateurs du mois validés', async () => {
      const now = new Date();
      const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      // Une recette et une dépense validées ce mois-ci, plus une recette en attente (exclue)
      for (const [transactionType, amount, status] of [
        ['INCOME', '1000000.25', 'VALIDATED'],
        ['EXPENSE', '250000.10', 'VALIDATED'],
        ['INCOME', '999.99', 'PENDING'],
      ] as const) {
        fixtureCounter += 1;
        await prisma.transaction.create({
          data: {
            reference: `TRX-DASH-${fixtureCounter}`,
            transactionType,
            amount,
            status,
            createdBy: adminId,
            departmentId: dep('CF'),
          },
        });
      }
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const sum = async (transactionType: TransactionType) =>
        (
          await prisma.transaction.aggregate({
            where: { transactionType, status: 'VALIDATED', createdAt: { gte: start, lt: end } },
            _sum: { amount: true },
          })
        )._sum.amount!.toFixed(2);

      const response = await call('GET', '/dashboard', sessions.accountant);
      expect(response.status).toBe(200);
      expect(response.body.role).toBe('ACCOUNTANT');
      expect(response.body.indicators).toMatchObject({
        month,
        monthIncome: await sum(TransactionType.INCOME),
        monthExpense: await sum(TransactionType.EXPENSE),
        pendingInvoicesTotal: await prisma.invoice.count({ where: { status: { in: ['SENT', 'OVERDUE'] } } }),
      });
      expect(typeof response.body.indicators.monthIncome).toBe('string');

      const latest = await prisma.transaction.findMany({
        orderBy: [{ createdAt: 'desc' }, { reference: 'desc' }],
        take: 5,
      });
      expect(response.body.recentTransactions.map((t: { id: string }) => t.id)).toEqual(latest.map((t) => t.id));
      expect(response.body.pendingInvoices.length).toBeLessThanOrEqual(5);
      expect(response.body.pendingInvoices.length).toBeGreaterThan(0);
      for (const invoice of response.body.pendingInvoices) {
        expect(['SENT', 'OVERDUE']).toContain(invoice.status);
        expect(invoice.amount).toMatch(AMOUNT_STRING);
      }
    });

    it('aucune carte finance pour les autres rôles (DM : rien de plus, AppFlow §5)', async () => {
      for (const role of ['admin', 'manager', 'employee'] as const) {
        const response = await call('GET', '/dashboard', sessions[role]);
        expect(response.status).toBe(200);
        expect(response.body.recentTransactions).toBeUndefined();
        expect(response.body.pendingInvoices).toBeUndefined();
        expect(response.body.indicators.monthIncome).toBeUndefined();
      }
    });
  });

  describe('audit (R12.3, R12.4, R13.2)', () => {
    it('création, validation et changement de statut de facture sont journalisés', async () => {
      const created = await call('POST', '/transactions', sessions.accountant, validBody());
      const accountantId = (await prisma.user.findUniqueOrThrow({ where: { username: 'ibrahima.sow' } })).id;
      const createLog = await prisma.auditLog.findFirstOrThrow({
        where: { resourceId: created.body.id, action: 'transaction.create' },
      });
      expect(createLog).toMatchObject({ actorId: accountantId, resourceType: 'Transaction' });
      expect(createLog.newValues).toMatchObject({ reference: created.body.reference, amount: '1500.50', status: 'PENDING' });

      await call('PATCH', `/transactions/${created.body.id}/status`, sessions.admin, { status: 'VALIDATED' });
      const statusLog = await prisma.auditLog.findFirstOrThrow({
        where: { resourceId: created.body.id, action: 'transaction.status_change' },
      });
      expect(statusLog).toMatchObject({ actorId: adminId, oldValues: { status: 'PENDING' }, newValues: { status: 'VALIDATED' } });

      const invoice = await makeInvoice('CO', InvoiceStatus.DRAFT);
      await call('PATCH', `/invoices/${invoice.id}/status`, sessions.accountant, { status: 'SENT' });
      const invoiceLog = await prisma.auditLog.findFirstOrThrow({
        where: { resourceId: invoice.id, action: 'invoice.status_change' },
      });
      expect(invoiceLog).toMatchObject({
        actorId: accountantId,
        resourceType: 'Invoice',
        oldValues: { status: 'DRAFT' },
        newValues: { status: 'SENT' },
      });
    });

    it('les lectures ne sont pas journalisées', async () => {
      const invoice = await makeInvoice('RH');
      await call('GET', `/invoices/${invoice.id}`, sessions.manager);
      await call('GET', '/transactions', sessions.manager);
      expect(await prisma.auditLog.count({ where: { resourceId: invoice.id } })).toBe(0);
    });
  });
});
