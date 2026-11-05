import { PrismaClient } from '@prisma/client';
import { resetDatabase, runSeed, testPrisma } from './helpers.js';

describe('Seed MVP 1 (intégration)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = testPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const counts = async () => ({
    departments: await prisma.department.count(),
    positions: await prisma.position.count(),
    employees: await prisma.employee.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
    rolePermissions: await prisma.rolePermission.count(),
    users: await prisma.user.count(),
    employeeIdentities: await prisma.employeeIdentity.count(),
    userRoles: await prisma.userRole.count(),
  });

  it('lancé deux fois : aucun doublon', async () => {
    const first = runSeed();
    expect(first.status, first.stderr).toBe(0);
    const afterFirst = await counts();

    const second = runSeed();
    expect(second.status, second.stderr).toBe(0);
    const afterSecond = await counts();

    expect(afterSecond).toEqual(afterFirst);
    expect(afterSecond).toEqual({
      departments: 6,
      positions: 6,
      employees: 6,
      roles: 3,
      permissions: 6,
      rolePermissions: 13, // 6 SUPER_ADMIN + 4 DEPARTMENT_MANAGER + 3 EMPLOYEE
      users: 3,
      employeeIdentities: 3,
      userRoles: 3,
    });
  });

  it('refusé quand NODE_ENV=production : code non nul, message explicite, aucune écriture', async () => {
    const result = runSeed({ NODE_ENV: 'production' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('NODE_ENV=production');
    expect(result.stderr).toContain('réservé au développement');
    expect(Object.values(await counts()).every((count) => count === 0)).toBe(true);
  });
});
