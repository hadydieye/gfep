import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { CREDENTIALS, createTestApp, resetDatabase, seedOrThrow, sessionCookie, testPrisma } from './helpers.js';

/**
 * Critère de passage 2.4 (`06` §2.4, R21) : chacun des 8 rôles a un comportement
 * distinct, vérifié sur au moins un endpoint représentatif de chaque module :
 * dashboard, employés, départements, documents, finance, accès.
 */
type RoleKey = keyof typeof CREDENTIALS;

const ROLE_NAME: Record<RoleKey, string> = {
  admin: 'SUPER_ADMIN',
  itAdmin: 'IT_ADMINISTRATOR',
  itTech: 'IT_TECHNICIAN',
  hr: 'HR_MANAGER',
  accountant: 'ACCOUNTANT',
  manager: 'DEPARTMENT_MANAGER',
  employee: 'EMPLOYEE',
  auditor: 'AUDITOR',
};

// Endpoints représentatifs. Les écritures envoient un corps vide : un rôle autorisé
// reçoit 400 (aucune écriture), un rôle non autorisé 403.
const PROBES = [
  { module: 'dashboard', label: 'GET /dashboard', method: 'GET', path: '/dashboard' },
  { module: 'employés', label: 'GET /employees', method: 'GET', path: '/employees' },
  { module: 'employés', label: 'POST /employees', method: 'POST', path: '/employees' },
  { module: 'employés', label: 'PATCH /employees/:id/status', method: 'PATCH', path: '/employees/:employee/status' },
  { module: 'départements', label: 'GET /departments', method: 'GET', path: '/departments' },
  { module: 'documents', label: 'GET /documents', method: 'GET', path: '/documents' },
  { module: 'documents', label: 'PATCH /documents/:id/validation', method: 'PATCH', path: '/documents/:document/validation' },
  { module: 'finance', label: 'GET /transactions', method: 'GET', path: '/transactions' },
  { module: 'finance', label: 'POST /transactions', method: 'POST', path: '/transactions' },
  { module: 'finance', label: 'PATCH /transactions/:id/status', method: 'PATCH', path: '/transactions/:transaction/status' },
  { module: 'finance', label: 'GET /invoices', method: 'GET', path: '/invoices' },
  { module: 'finance', label: 'PATCH /invoices/:id/status', method: 'PATCH', path: '/invoices/:invoice/status' },
  { module: 'accès', label: 'GET /access/users', method: 'GET', path: '/access/users' },
  { module: 'accès', label: 'GET /access/roles', method: 'GET', path: '/access/roles' },
  { module: 'accès', label: 'PUT /access/roles/:id/permissions', method: 'PUT', path: '/access/roles/:role/permissions' },
  { module: 'accès', label: 'PUT /access/users/:id/roles', method: 'PUT', path: '/access/users/:user/roles' },
  // Étape 2.6 : audit réservé au SUPER_ADMIN et à l'AUDITOR (M21)
  { module: 'audit', label: 'GET /audit/logs', method: 'GET', path: '/audit/logs' },
] as const;

// Résultat attendu par rôle, dans l'ordre de PROBES (design §2, M15, M18, M21)
const EXPECTED: Record<RoleKey, number[]> = {
  //            dash emp  empW empS dep  doc  docV trx  trxW trxV inv  invS usr  rol  rolW usrR aud
  admin: /*   */ [200, 200, 400, 400, 200, 200, 400, 200, 400, 400, 200, 400, 200, 200, 400, 400, 200],
  itAdmin: /* */ [200, 200, 403, 403, 200, 200, 403, 403, 403, 403, 403, 403, 200, 200, 403, 400, 403],
  itTech: /*  */ [200, 200, 403, 403, 200, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403],
  hr: /*      */ [200, 200, 400, 400, 200, 200, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403],
  accountant: [200, 200, 403, 403, 200, 200, 403, 200, 400, 403, 200, 400, 403, 403, 403, 403, 403],
  manager: /* */ [200, 200, 400, 400, 200, 200, 400, 200, 403, 403, 200, 403, 403, 403, 403, 403, 403],
  employee: /**/ [200, 200, 403, 403, 200, 200, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403],
  auditor: /* */ [200, 200, 403, 403, 200, 200, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 200],
};

describe('Critère 2.4 : comportement distinct des 8 rôles (intégration)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaClient;
  let sessions: Record<RoleKey, string>;
  let ids: Record<string, string>;

  beforeAll(async () => {
    prisma = testPrisma();
    await resetDatabase(prisma);
    seedOrThrow();
    app = await createTestApp();
    sessions = Object.fromEntries(
      await Promise.all(
        (Object.keys(CREDENTIALS) as RoleKey[]).map(async (key) => [key, await sessionCookie(app, CREDENTIALS[key])] as const),
      ),
    ) as Record<RoleKey, string>;
    // Cibles dans le département AC du DEPARTMENT_MANAGER a.barry, pour que son scope s'applique
    const ac = await prisma.department.findUniqueOrThrow({ where: { code: 'AC' } });
    ids = {
      employee: (await prisma.employee.findFirstOrThrow({ where: { departmentId: ac.id, employeeNumber: { not: 'GF-2026-005' } } })).id,
      document: (await prisma.document.findFirstOrThrow({ where: { category: { departmentId: ac.id }, confidentialityLevel: 'INTERNAL' } })).id,
      transaction: (await prisma.transaction.findFirstOrThrow({ where: { departmentId: ac.id } })).id,
      invoice: (await prisma.invoice.findFirstOrThrow({ where: { departmentId: ac.id } })).id,
      role: (await prisma.role.findUniqueOrThrow({ where: { name: 'AUDITOR' } })).id,
      user: (await prisma.user.findUniqueOrThrow({ where: { username: 'k.bangoura' } })).id,
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const probe = (cookie: string, method: string, path: string) => {
    const resolved = `/api/v1${path.replace(/:(\w+)/g, (_, key: string) => ids[key])}`;
    const server = request(app.getHttpServer());
    const req =
      method === 'GET'
        ? server.get(resolved)
        : method === 'POST'
          ? server.post(resolved)
          : method === 'PATCH'
            ? server.patch(resolved)
            : server.put(resolved);
    return req.set('Cookie', cookie).send(method === 'GET' ? undefined : {});
  };

  const results = new Map<RoleKey, number[]>();

  it.each(Object.keys(EXPECTED) as RoleKey[])('%s : résultat attendu sur chaque module', async (key) => {
    const statuses: number[] = [];
    for (const { method, path } of PROBES) {
      statuses.push((await probe(sessions[key], method, path)).status);
    }
    results.set(key, statuses);
    const table = PROBES.map((p, i) => `${p.label} → ${statuses[i]}`);
    expect(table).toEqual(PROBES.map((p, i) => `${p.label} → ${EXPECTED[key][i]}`));
    // Au moins un endpoint de chaque module a été sondé
    expect(new Set(PROBES.map((p) => p.module))).toEqual(
      new Set(['dashboard', 'employés', 'départements', 'documents', 'finance', 'accès', 'audit']),
    );
  });

  it('dashboard : contenu propre à chaque rôle (AppFlow §5, design §6.2)', async () => {
    const dashboards = Object.fromEntries(
      await Promise.all(
        (Object.keys(ROLE_NAME) as RoleKey[]).map(
          async (key) => [key, (await probe(sessions[key], 'GET', '/dashboard')).body] as const,
        ),
      ),
    ) as Record<RoleKey, Record<string, unknown> & { indicators: Record<string, unknown> }>;
    for (const key of Object.keys(ROLE_NAME) as RoleKey[]) {
      expect(dashboards[key].role, key).toBe(ROLE_NAME[key]);
    }
    const signature = (body: Record<string, unknown> & { indicators: Record<string, unknown> }) =>
      [
        ...Object.keys(body.indicators).map((k) => `indicators.${k}`),
        ...Object.keys(body).filter((k) => !['role', 'indicators', 'recentActivity'].includes(k)),
      ].sort();

    // SUPER_ADMIN : vue consolidée de tous les indicateurs (AppFlow §5, N10, étape 3.1)
    expect(signature(dashboards.admin)).toEqual([
      'headcountByDepartment',
      'indicators.month',
      'indicators.monthExpense',
      'indicators.monthIncome',
      'indicators.pendingInvoicesTotal',
      'indicators.totalEmployees',
      'pendingDocuments',
      'pendingDocumentsTotal',
      'pendingInvoices',
      'recentAccounts',
      'recentHires',
      'recentSecurityEvents',
      'recentTransactions',
      'securityAlerts',
      'services',
    ]);
    expect(signature(dashboards.itAdmin)).toEqual(['recentAccounts', 'recentSecurityEvents', 'services']);
    expect(signature(dashboards.itTech)).toEqual(['services']);
    expect(signature(dashboards.hr)).toEqual(['headcountByDepartment', 'indicators.totalEmployees', 'recentHires']);
    expect(signature(dashboards.accountant)).toEqual([
      'indicators.month',
      'indicators.monthExpense',
      'indicators.monthIncome',
      'indicators.pendingInvoicesTotal',
      'pendingInvoices',
      'recentTransactions',
    ]);
    expect(signature(dashboards.manager)).toEqual([
      'indicators.departmentEmployees',
      'indicators.departmentName',
      'pendingDocuments',
    ]);
    expect(signature(dashboards.employee)).toEqual(['recentDocuments', 'recentNotifications']);
    // AUDITOR (étape 2.6) : derniers audits (recentActivity) et alertes de sécurité HIGH/CRITICAL
    expect(signature(dashboards.auditor)).toEqual(['securityAlerts']);

    expect(dashboards.admin.services).toEqual({ database: 'UP', ldap: 'NOT_CONFIGURED' });
    const headcount = dashboards.hr.headcountByDepartment as Array<{ code: string; count: number }>;
    expect(headcount).toHaveLength(6);
    expect(headcount.reduce((sum, d) => sum + d.count, 0)).toBe(await prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } }));
    expect((dashboards.hr.recentHires as unknown[]).length).toBe(5);
  });

  it('les 8 rôles ont 8 comportements distincts (endpoints et dashboard)', () => {
    const behaviours = (Object.keys(EXPECTED) as RoleKey[]).map((key) => `${ROLE_NAME[key]}:${results.get(key)?.join(',')}`);
    expect(results.size).toBe(8);
    const byStatuses = new Set((Object.keys(EXPECTED) as RoleKey[]).map((key) => results.get(key)!.join(',')));
    // À partir de 2.6, l'audit distingue aussi EMPLOYEE et AUDITOR sur les endpoints
    expect(byStatuses.size, behaviours.join('\n')).toBe(8);
  });
});
