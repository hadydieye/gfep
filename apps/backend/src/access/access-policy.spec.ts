import { ForbiddenException } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import {
  actsOnSuperAdminWithoutBeingOne,
  assertMayManageAccount,
  isLastActiveSuperAdmin,
  isSelf,
} from './access-policy.js';

const actor = (roles: string[], id = 'actor'): AuthenticatedUser => ({
  id,
  sessionId: 's',
  username: id,
  email: `${id}@example.test`,
  status: UserStatus.ACTIVE,
  roles,
  permissions: [],
  employeeIdentity: null,
});

const txWithActiveSuperAdmins = (count: number) =>
  ({ user: { count: vi.fn(async () => count) } }) as unknown as Prisma.TransactionClient;

describe('politique anti-escalade (M17)', () => {
  it('soi-même', () => {
    expect(isSelf(actor(['SUPER_ADMIN'], 'a'), 'a')).toBe(true);
    expect(isSelf(actor(['SUPER_ADMIN'], 'a'), 'b')).toBe(false);
  });

  it('seul un SUPER_ADMIN agit sur un compte SUPER_ADMIN', () => {
    const superAdmin = { id: 't', roles: ['SUPER_ADMIN'] };
    expect(actsOnSuperAdminWithoutBeingOne(actor(['IT_ADMINISTRATOR']), superAdmin)).toBe(true);
    expect(actsOnSuperAdminWithoutBeingOne(actor(['HR_MANAGER']), superAdmin)).toBe(true);
    expect(actsOnSuperAdminWithoutBeingOne(actor(['SUPER_ADMIN']), superAdmin)).toBe(false);
    expect(actsOnSuperAdminWithoutBeingOne(actor(['IT_ADMINISTRATOR']), { id: 'e', roles: ['EMPLOYEE'] })).toBe(false);
  });

  it('dernier SUPER_ADMIN actif : aucun autre SUPER_ADMIN ACTIVE', () => {
    expect(isLastActiveSuperAdmin({ id: 't', roles: ['SUPER_ADMIN'] }, 0)).toBe(true);
    expect(isLastActiveSuperAdmin({ id: 't', roles: ['SUPER_ADMIN'] }, 1)).toBe(false);
    expect(isLastActiveSuperAdmin({ id: 'e', roles: ['EMPLOYEE'] }, 0)).toBe(false);
  });

  it('assertMayManageAccount : refuse le dernier SUPER_ADMIN actif même pour un SUPER_ADMIN tiers', async () => {
    const target = { id: 't', roles: ['SUPER_ADMIN'] };
    await expect(
      assertMayManageAccount(txWithActiveSuperAdmins(0), actor(['SUPER_ADMIN']), target, { protectsLastSuperAdmin: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      assertMayManageAccount(txWithActiveSuperAdmins(1), actor(['SUPER_ADMIN']), target, { protectsLastSuperAdmin: true }),
    ).resolves.toBeUndefined();
  });

  it('assertMayManageAccount : soi-même et non-SUPER_ADMIN sur SUPER_ADMIN refusés avant tout comptage', async () => {
    const tx = txWithActiveSuperAdmins(5);
    await expect(
      assertMayManageAccount(tx, actor(['SUPER_ADMIN'], 't'), { id: 't', roles: ['SUPER_ADMIN'] }, { protectsLastSuperAdmin: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      assertMayManageAccount(tx, actor(['IT_ADMINISTRATOR']), { id: 't', roles: ['SUPER_ADMIN'] }, { protectsLastSuperAdmin: true }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((tx.user.count as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});
