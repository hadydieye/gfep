import { readFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { AuthProvider, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { resetDatabase, runSeed, testPrisma } from './helpers.js';
import { testStorageDir } from './setup/test-database.js';

// Volumes après T2.3.2 (gfep-mvp2/DECISIONS.md M6, M24)
const EXPECTED_COUNTS = {
  departments: 6,
  positions: 18,
  employees: 40,
  users: 40,
  employeeIdentities: 40,
  roles: 4,
  permissions: 16,
  // SUPER_ADMIN 16, DEPARTMENT_MANAGER 11, EMPLOYEE 7, ACCOUNTANT 11
  rolePermissions: 45,
  userRoles: 40,
  documentCategories: 6,
  documents: 50,
  documentPermissions: 5,
  invoices: 30,
  transactions: 100,
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

  it('peuple toutes les tables aux volumes attendus en 2.2', async () => {
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

  it('attribue les permissions Documents selon la matrice de l’étape 2.2', async () => {
    expect(runSeed().status).toBe(0);
    const permissionsFor = async (username: string) => {
      const assignments = await prisma.rolePermission.findMany({
        where: { role: { userRoles: { some: { user: { username } } } } },
        include: { permission: true },
      });
      return assignments
        .filter(({ permission }) => permission.resource === 'documents')
        .map(({ permission }) => permission.action)
        .sort();
    };

    expect(await permissionsFor('m.keita')).toEqual(['delete', 'read', 'share', 'validate', 'write']);
    expect(await permissionsFor('f.camara')).toEqual(['delete', 'read', 'share', 'validate', 'write']);
    expect(await permissionsFor('m.diallo')).toEqual(['delete', 'read', 'share', 'write']);
    expect(await permissionsFor('ibrahima.sow')).toEqual(['delete', 'read', 'share', 'write']);
  });

  it('attribue les permissions finance selon la matrice de l’étape 2.3', async () => {
    expect(runSeed().status).toBe(0);
    const financeOf = async (username: string) =>
      (
        await prisma.rolePermission.findMany({
          where: {
            role: { userRoles: { some: { user: { username } } } },
            permission: { resource: { in: ['transactions', 'invoices'] } },
          },
          include: { permission: true },
        })
      )
        .map(({ permission }) => `${permission.resource}:${permission.action}`)
        .sort();

    expect(await financeOf('m.keita')).toEqual([
      'invoices:read',
      'invoices:status',
      'transactions:read',
      'transactions:validate',
      'transactions:write',
    ]);
    expect(await financeOf('ibrahima.sow')).toEqual([
      'invoices:read',
      'invoices:status',
      'transactions:read',
      'transactions:write',
    ]);
    expect(await financeOf('f.camara')).toEqual(['invoices:read', 'transactions:read']);
    expect(await financeOf('m.diallo')).toEqual([]);
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

  it('personas et comptes conformes à M5 pour l’étape 2.3', async () => {
    expect(runSeed().status).toBe(0);
    const roleOf = async (username: string) =>
      (
        await prisma.userRole.findMany({ where: { user: { username } }, include: { role: true } })
      ).map((r) => r.role.name);
    expect(await roleOf('m.keita')).toEqual(['SUPER_ADMIN']);
    expect(await roleOf('f.camara')).toEqual(['DEPARTMENT_MANAGER']);
    expect(await roleOf('t.balde')).toEqual(['EMPLOYEE']);
    // M6 : ibrahima.sow reçoit ACCOUNTANT et perd EMPLOYEE
    expect(await roleOf('ibrahima.sow')).toEqual(['ACCOUNTANT']);
    expect(await prisma.userRole.count({ where: { role: { name: 'EMPLOYEE' } } })).toBe(37);
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
    for (const password of [secret, 'GF_Admin2026!', 'GF_Mgr2026!', 'GF_Emp2026!', 'GF_Acc2026!']) {
      expect(output).not.toContain(password);
    }
    const employee = await prisma.user.findUniqueOrThrow({ where: { username: 'm.diallo' } });
    expect(await argon2.verify(employee.passwordHash!, secret)).toBe(true);
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'm.keita' } });
    expect(await argon2.verify(admin.passwordHash!, 'GF_Admin2026!')).toBe(true);

    const accountantSecret = 'Seed-Test-Acc-7b21';
    const accountantRun = runSeed({ SEED_PASSWORD_ACCOUNTANT: accountantSecret });
    expect(accountantRun.status, accountantRun.stderr).toBe(0);
    expect(`${accountantRun.stdout}${accountantRun.stderr}`).not.toContain(accountantSecret);
    const accountant = await prisma.user.findUniqueOrThrow({ where: { username: 'ibrahima.sow' } });
    expect(await argon2.verify(accountant.passwordHash!, accountantSecret)).toBe(true);
  });

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
