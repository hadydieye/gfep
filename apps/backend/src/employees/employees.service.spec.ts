import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EmployeesService, MAX_EMPLOYEE_NUMBER_ATTEMPTS } from './employees.service.js';

const admin: AuthenticatedUser = {
  id: 'u1',
  sessionId: 's1',
  username: 'admin',
  email: 'admin@test',
  status: 'ACTIVE',
  roles: ['SUPER_ADMIN'],
  permissions: [],
  employeeIdentity: null,
};

const dto = {
  firstName: 'Awa',
  lastName: 'Condé',
  professionalEmail: 'a.conde@guineasf.com',
  departmentId: 'd1',
  positionId: 'p1',
  hireDate: '2026-01-05',
};

const uniqueViolation = (target: string[] | string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: Prisma.prismaVersion.client,
    meta: { target },
  });

/** Prisma factice : `create` échoue selon le scénario fourni, puis réussit. */
function fakePrisma(existingNumbers: string[], failures: unknown[]) {
  const create = vi.fn(async ({ data }: { data: { employeeNumber: string } }) => {
    const failure = failures.shift();
    if (failure) throw failure;
    const now = new Date();
    return {
      ...dto,
      ...data,
      id: 'e1',
      phone: null,
      managerId: null,
      manager: null,
      employmentStatus: 'ACTIVE',
      hireDate: now,
      createdAt: now,
      updatedAt: now,
      department: { id: 'd1', name: 'RH', code: 'RH' },
      position: { id: 'p1', title: 'Responsable RH' },
    };
  });
  const tx = {
    employee: {
      findMany: vi.fn(async () => existingNumbers.map((employeeNumber) => ({ employeeNumber }))),
      create,
    },
  };
  const prisma = {
    department: { findUnique: vi.fn(async () => ({ id: 'd1' })) },
    position: { findUnique: vi.fn(async () => ({ departmentId: 'd1' })) },
    employee: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new EmployeesService(prisma as unknown as PrismaService, new AuditService()), create };
}

const year = new Date().getFullYear();

describe('EmployeesService.create — numérotation et conflits', () => {
  it('numéro = plus grand suffixe de l’année courante + 1 (trous et autres années ignorés)', async () => {
    const { service } = fakePrisma([`GF-${year}-001`, `GF-${year}-004`, `GF-${year}-XYZ`], []);
    const employee = await service.create(dto, admin);
    expect(employee.employeeNumber).toBe(`GF-${year}-005`);
  });

  it('premier numéro de l’année : 001', async () => {
    const { service } = fakePrisma([], []);
    expect((await service.create(dto, admin)).employeeNumber).toBe(`GF-${year}-001`);
  });

  it('réessaie en cas de conflit sur employeeNumber, puis réussit', async () => {
    const { service, create } = fakePrisma([], [
      uniqueViolation(['employeeNumber']),
      uniqueViolation('employees_employeeNumber_key'),
    ]);
    await expect(service.create(dto, admin)).resolves.toMatchObject({ id: 'e1' });
    expect(create).toHaveBeenCalledTimes(3);
  });

  it(`abandonne après ${MAX_EMPLOYEE_NUMBER_ATTEMPTS} conflits, sans parler d’email`, async () => {
    const failures = Array.from({ length: MAX_EMPLOYEE_NUMBER_ATTEMPTS }, () =>
      uniqueViolation(['employeeNumber']),
    );
    const { service, create } = fakePrisma([], failures);
    const error = await service.create(dto, admin).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).not.toMatch(/email/i);
    expect(create).toHaveBeenCalledTimes(MAX_EMPLOYEE_NUMBER_ATTEMPTS);
  });

  it('conflit sur professionalEmail : message email, sans nouvel essai', async () => {
    const { service, create } = fakePrisma([], [uniqueViolation(['professionalEmail'])]);
    await expect(service.create(dto, admin)).rejects.toThrow(
      'Un employé avec cet email professionnel existe déjà.',
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('autre conflit d’unicité : message neutre', async () => {
    const { service } = fakePrisma([], [uniqueViolation(['autreColonne'])]);
    const error = await service.create(dto, admin).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).not.toMatch(/email|numéro/i);
  });
});
