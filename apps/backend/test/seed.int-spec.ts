import { readFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { AuthProvider, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { resetDatabase, runSeed, testPrisma } from './helpers.js';
import { testStorageDir } from './setup/test-database.js';

// Volumes de l'étape 2.1 (gfep-mvp2/requirements.md R1.4, DECISIONS.md M3)
const EXPECTED_COUNTS = {
  departments: 6,
  positions: 18,
  employees: 40,
  users: 40,
  employeeIdentities: 40,
  roles: 3,
  permissions: 6,
  rolePermissions: 13, // 6 SUPER_ADMIN + 4 DEPARTMENT_MANAGER + 3 EMPLOYEE
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

  it('peuple toutes les tables aux volumes de l’étape 2.1', async () => {
    const result = runSeed();
    expect(result.status, result.stderr).toBe(0);
    expect(await counts()).toEqual(EXPECTED_COUNTS);
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

  it('personas et comptes conformes à M5 pour l’étape 2.1', async () => {
    expect(runSeed().status).toBe(0);
    const roleOf = async (username: string) =>
      (
        await prisma.userRole.findMany({ where: { user: { username } }, include: { role: true } })
      ).map((r) => r.role.name);
    expect(await roleOf('m.keita')).toEqual(['SUPER_ADMIN']);
    expect(await roleOf('f.camara')).toEqual(['DEPARTMENT_MANAGER']);
    expect(await roleOf('t.balde')).toEqual(['EMPLOYEE']);
    expect(await prisma.userRole.count({ where: { role: { name: 'EMPLOYEE' } } })).toBe(38);
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
    for (const password of [secret, 'GF_Admin2026!', 'GF_Mgr2026!', 'GF_Emp2026!']) {
      expect(output).not.toContain(password);
    }
    const employee = await prisma.user.findUniqueOrThrow({ where: { username: 'm.diallo' } });
    expect(await argon2.verify(employee.passwordHash!, secret)).toBe(true);
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'm.keita' } });
    expect(await argon2.verify(admin.passwordHash!, 'GF_Admin2026!')).toBe(true);
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
