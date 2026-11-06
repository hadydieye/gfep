import { readFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { AuthProvider, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { resetDatabase, runSeed, testPrisma } from './helpers.js';
import { testStorageDir } from './setup/test-database.js';

// Volumes après T3.2.2 (gfep-mvp2 M5, M24 ; gfep-mvp3 N29 : 34 permissions)
const EXPECTED_COUNTS = {
  departments: 6,
  positions: 18,
  employees: 40,
  users: 40,
  employeeIdentities: 40,
  roles: 8,
  permissions: 34,
  // SA 34, ITA 18, ITT 7, HR 14, ACC 15, DM 16, EMP 11, AUD 14
  rolePermissions: 129,
  userRoles: 40,
  documentCategories: 6,
  documents: 50,
  documentPermissions: 5,
  invoices: 30,
  transactions: 100,
};

// Matrice finale exacte (design §2)
const READ_BASE = [
  'dashboard:read',
  'departments:read',
  'employees:read',
  'notifications:read',
  'notifications:update',
  'profile:read',
  'profile:update',
];
const DOCS = ['documents:delete', 'documents:read', 'documents:share', 'documents:write'];
const ALL_PERMISSIONS = [
  'ad_mappings:read',
  'ad_mappings:write',
  'audit:read',
  'dashboard:read',
  'departments:read',
  'departments:write',
  'documents:delete',
  'documents:history',
  'documents:read',
  'documents:share',
  'documents:validate',
  'documents:write',
  'employees:delete',
  'employees:read',
  'employees:status',
  'employees:write',
  'invoices:read',
  'invoices:status',
  'notifications:read',
  'notifications:update',
  'profile:read',
  'profile:update',
  'roles:read',
  'roles:write',
  'security_events:read',
  'settings:read',
  'settings:write',
  'transactions:read',
  'transactions:validate',
  'transactions:write',
  'users:assign_role',
  'users:read',
  'users:suspend',
  'users:unlock',
];
const EXPECTED_MATRIX: Record<string, string[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  IT_ADMINISTRATOR: [
    ...READ_BASE,
    ...DOCS,
    'ad_mappings:read',
    'ad_mappings:write',
    'roles:read',
    'users:assign_role',
    'users:read',
    'users:suspend',
    'users:unlock',
  ],
  IT_TECHNICIAN: READ_BASE,
  HR_MANAGER: [...READ_BASE, 'departments:write', ...DOCS, 'employees:status', 'employees:write'],
  ACCOUNTANT: [...READ_BASE, ...DOCS, 'invoices:read', 'invoices:status', 'transactions:read', 'transactions:write'],
  DEPARTMENT_MANAGER: [
    ...READ_BASE,
    ...DOCS,
    'documents:validate',
    'employees:status',
    'employees:write',
    'invoices:read',
    'transactions:read',
  ],
  EMPLOYEE: [...READ_BASE, ...DOCS],
  AUDITOR: [...READ_BASE, ...DOCS, 'audit:read', 'documents:history', 'security_events:read'],
};

// Signatures de fichier attendues par type MIME
const MAGIC: Record<string, (bytes: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) =>
    b.subarray(0, 4).equals(Buffer.from('PK\x03\x04', 'latin1')) && b.includes('word/document.xml'),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) =>
    b.subarray(0, 4).equals(Buffer.from('PK\x03\x04', 'latin1')) && b.includes('xl/workbook.xml'),
};

describe('Seed complet (intégration)', () => {
  let prisma: PrismaClient;
  const storage = testStorageDir();

  beforeAll(() => {
    prisma = testPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    rmSync(storage, { recursive: true, force: true });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const counts = async () => ({
    departments: await prisma.department.count(),
    positions: await prisma.position.count(),
    employees: await prisma.employee.count(),
    users: await prisma.user.count(),
    employeeIdentities: await prisma.employeeIdentity.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    rolePermissions: await prisma.rolePermission.count(),
    userRoles: await prisma.userRole.count(),
    documentCategories: await prisma.documentCategory.count(),
    documents: await prisma.document.count(),
    documentPermissions: await prisma.documentPermission.count(),
    invoices: await prisma.invoice.count(),
    transactions: await prisma.transaction.count(),
  });

  const storedFiles = () => readdirSync(storage).sort();

  it('peuple toutes les tables aux volumes attendus en 2.4', async () => {
    const result = runSeed();
    expect(result.status, result.stderr).toBe(0);
    expect(await counts()).toEqual(EXPECTED_COUNTS);
    expect(await prisma.document.groupBy({ by: ['validationStatus'], _count: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ validationStatus: 'PENDING' }),
        expect.objectContaining({ validationStatus: 'VALIDATED' }),
        expect.objectContaining({ validationStatus: 'REJECTED' }),
      ]),
    );
  });

  it('matrice 8 rôles exacte, sans doublon ni permission orpheline (design §2, M24)', async () => {
    expect(runSeed().status).toBe(0);
    const roles = await prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
    const matrix = Object.fromEntries(
      roles.map((role) => [
        role.name,
        role.rolePermissions.map(({ permission }) => `${permission.resource}:${permission.action}`).sort(),
      ]),
    );
    expect(Object.keys(matrix).sort()).toEqual(Object.keys(EXPECTED_MATRIX).sort());
    for (const [role, keys] of Object.entries(EXPECTED_MATRIX)) {
      expect(matrix[role], role).toEqual([...keys].sort());
      expect(new Set(matrix[role]).size, `${role} sans doublon`).toBe(matrix[role].length);
    }
    // Catalogue : 34 permissions, chacune détenue par au moins un rôle (SUPER_ADMIN les détient toutes)
    const catalog = (await prisma.permission.findMany()).map((p) => `${p.resource}:${p.action}`).sort();
    expect(catalog).toEqual(ALL_PERMISSIONS);
    const orphans = await prisma.permission.count({ where: { rolePermissions: { none: {} } } });
    expect(orphans).toBe(0);
  });

  it('aucune permission en trop pour IT_TECHNICIAN, AUDITOR et ACCOUNTANT', async () => {
    expect(runSeed().status).toBe(0);
    const resourcesOf = async (role: string) =>
      [
        ...new Set(
          (
            await prisma.rolePermission.findMany({ where: { role: { name: role } }, include: { permission: true } })
          ).map(({ permission }) => permission.resource),
        ),
      ].sort();
    // M15 : ni documents, ni finance, ni accès
    expect(await resourcesOf('IT_TECHNICIAN')).toEqual(['dashboard', 'departments', 'employees', 'notifications', 'profile']);
    // Lecture d'audit (2.6) ; ni finance, ni accès, ni écriture employé
    expect(await resourcesOf('AUDITOR')).toEqual([
      'audit',
      'dashboard',
      'departments',
      'documents',
      'employees',
      'notifications',
      'profile',
      'security_events',
    ]);
    expect(await resourcesOf('ACCOUNTANT')).toEqual([
      'dashboard',
      'departments',
      'documents',
      'employees',
      'invoices',
      'notifications',
      'profile',
      'transactions',
    ]);
    const writes = await prisma.rolePermission.count({
      where: {
        role: { name: { in: ['IT_TECHNICIAN', 'AUDITOR', 'ACCOUNTANT'] } },
        permission: {
          OR: [
            { resource: 'employees', action: { in: ['write', 'status', 'delete'] } },
            { resource: 'departments', action: 'write' },
            { resource: 'documents', action: 'validate' },
            { resource: 'transactions', action: 'validate' },
            { resource: { in: ['roles', 'users', 'ad_mappings', 'settings'] } },
          ],
        },
      },
    });
    expect(writes).toBe(0);
  });

  it('rattache chaque facture et chaque transaction à un département (M13)', async () => {
    expect(runSeed().status).toBe(0);
    expect(await prisma.invoice.count({ where: { departmentId: null } })).toBe(0);
    expect(await prisma.transaction.count({ where: { departmentId: null } })).toBe(0);
    const departments = await prisma.department.findMany({
      include: { _count: { select: { invoices: true, transactions: true } } },
    });
    expect(departments).toHaveLength(6);
    for (const department of departments) {
      expect(department._count.invoices, department.code).toBe(5);
      expect(department._count.transactions, department.code).toBeGreaterThanOrEqual(16);
    }
  });

  it('lancé deux fois : aucun doublon, mêmes fichiers', async () => {
    expect(runSeed().status).toBe(0);
    const afterFirst = await counts();
    const filesFirst = storedFiles();
    const pathsFirst = (await prisma.document.findMany({ select: { storagePath: true } }))
      .map((d) => d.storagePath)
      .sort();

    const second = runSeed();
    expect(second.status, second.stderr).toBe(0);
    expect(await counts()).toEqual(afterFirst);
    expect(storedFiles()).toEqual(filesFirst);
    expect(filesFirst).toHaveLength(EXPECTED_COUNTS.documents);
    const pathsSecond = (await prisma.document.findMany({ select: { storagePath: true } }))
      .map((d) => d.storagePath)
      .sort();
    expect(pathsSecond).toEqual(pathsFirst);
  });

  it('chaque document a un fichier réel dont la signature correspond à son type MIME', async () => {
    expect(runSeed().status).toBe(0);
    const documents = await prisma.document.findMany();
    for (const document of documents) {
      expect(document.storagePath, document.title).toMatch(/^[0-9a-f-]{36}$/);
      const bytes = readFileSync(join(storage, document.storagePath));
      expect(bytes.length, document.title).toBe(document.fileSize);
      expect(MAGIC[document.mimeType]?.(bytes), `${document.title} (${document.mimeType})`).toBe(true);
    }
  });

  it('personas et comptes conformes à M5 pour l’étape 2.4', async () => {
    expect(runSeed().status).toBe(0);
    const roleOf = async (username: string) =>
      (
        await prisma.userRole.findMany({ where: { user: { username } }, include: { role: true } })
      ).map((r) => r.role.name);
    // M5 : un seul rôle par compte, l'ancien est retiré
    expect(await roleOf('t.balde')).toEqual(['SUPER_ADMIN']);
    expect(await roleOf('m.keita')).toEqual(['IT_ADMINISTRATOR']);
    expect(await roleOf('f.camara')).toEqual(['HR_MANAGER']);
    expect(await roleOf('a.barry')).toEqual(['DEPARTMENT_MANAGER']);
    expect(await roleOf('ibrahima.sow')).toEqual(['ACCOUNTANT']);
    expect(await roleOf('s.toure')).toEqual(['AUDITOR']);
    expect(await roleOf('f.kaba')).toEqual(['IT_TECHNICIAN']);
    expect(await roleOf('m.diallo')).toEqual(['EMPLOYEE']);
    expect(await prisma.userRole.count({ where: { role: { name: 'EMPLOYEE' } } })).toBe(33);
    const barry = await prisma.employee.findFirstOrThrow({ where: { lastName: 'Barry' }, include: { department: true } });
    expect(barry.department.code).toBe('AC');
    expect(await prisma.user.count({ where: { authProvider: AuthProvider.LOCAL } })).toBe(40);

    const keita = await prisma.employee.findUniqueOrThrow({
      where: { employeeNumber: 'GF-2026-004' },
      include: { department: true, position: true },
    });
    expect([keita.department.code, keita.position.title]).toEqual(['IT', 'Administrateur systèmes']);
    const dg = await prisma.department.findUniqueOrThrow({ where: { code: 'DG' }, include: { manager: true } });
    expect(dg.manager?.lastName).toBe('Baldé');
    const sows = await prisma.employee.findMany({
      where: { lastName: 'Sow' },
      include: { department: true, identity: { include: { user: true } } },
      orderBy: { employeeNumber: 'asc' },
    });
    expect(sows.map((e) => [e.firstName, e.department.code, e.identity?.user.username])).toEqual([
      ['Ibrahim', 'IT', 'i.sow'],
      ['Ibrahima', 'CF', 'ibrahima.sow'],
    ]);
  });

  it('mots de passe surchargeables par variable d’environnement et jamais affichés', async () => {
    const secret = 'Seed-Test-Secret-9f3c';
    const result = runSeed({ SEED_PASSWORD_EMPLOYEE: secret });
    expect(result.status, result.stderr).toBe(0);

    const output = `${result.stdout}${result.stderr}`;
    const defaults = ['GF_Admin2026!', 'GF_Mgr2026!', 'GF_Emp2026!', 'GF_Acc2026!', 'GF_ItAdmin2026!', 'GF_ItTech2026!', 'GF_Hr2026!', 'GF_Audit2026!'];
    for (const password of [secret, ...defaults]) {
      expect(output).not.toContain(password);
    }
    const employee = await prisma.user.findUniqueOrThrow({ where: { username: 'm.diallo' } });
    expect(await argon2.verify(employee.passwordHash!, secret)).toBe(true);
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 't.balde' } });
    expect(await argon2.verify(admin.passwordHash!, 'GF_Admin2026!')).toBe(true);

    const accountantSecret = 'Seed-Test-Acc-7b21';
    const accountantRun = runSeed({ SEED_PASSWORD_ACCOUNTANT: accountantSecret });
    expect(accountantRun.status, accountantRun.stderr).toBe(0);
    expect(`${accountantRun.stdout}${accountantRun.stderr}`).not.toContain(accountantSecret);
    const accountant = await prisma.user.findUniqueOrThrow({ where: { username: 'ibrahima.sow' } });
    expect(await argon2.verify(accountant.passwordHash!, accountantSecret)).toBe(true);
    // Deux seeds complets (8 hachages argon2 chacun) : délai explicite
  }, 90_000);

  it('refusé quand NODE_ENV=production : code non nul, message explicite, aucune écriture', async () => {
    const result = runSeed({ NODE_ENV: 'production' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('NODE_ENV=production');
    expect(result.stderr).toContain('réservé au développement');
    expect(Object.values(await counts()).every((count) => count === 0)).toBe(true);
    expect(() => readdirSync(storage)).toThrow();
  });

  it('seed-mvp1.ts reste exécutable seul et refuse aussi la production', async () => {
    expect(runSeed({ NODE_ENV: 'production' }, 'prisma/seed-mvp1.ts').status).not.toBe(0);
    const result = runSeed({}, 'prisma/seed-mvp1.ts');
    expect(result.status, result.stderr).toBe(0);
    expect(await prisma.employee.count()).toBe(6);
    expect(await prisma.user.count()).toBe(3);
  });
});
