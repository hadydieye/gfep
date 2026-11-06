import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeStatusActions } from '@/components/employees/employee-status-actions';
import { navItemsFor } from '@/components/layout/nav-items';
import { Checkbox } from '@/components/ui/checkbox';
import type { Account, AuthUser, RoleDetail } from '@/lib/api/types';
import { canChangeEmployeeStatus, canWriteEmployee } from '@/lib/auth/scope';
import { primaryRole } from '@/lib/auth/session';
import { AccountStatusBadge } from '../access-labels';
import { AccountsList } from '../accounts-list';
import { RolePermissionsEditor } from '../role-permissions-editor';

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const perms = (...keys: string[]) => keys.map((key) => ({ resource: key.split(':')[0], action: key.split(':')[1] }));

const user = (roles: string[], permissions: string[], employee = { id: 'me', departmentId: 'dep-ac' }): AuthUser => ({
  id: 'u',
  username: 'u',
  email: 'u@example.test',
  status: 'ACTIVE',
  roles: roles.map((name) => ({ id: name, name })),
  permissions: perms(...permissions),
  employee: { ...employee, firstName: 'A', lastName: 'B' },
});

describe('menu Accès (R20.2)', () => {
  it('IT_ADMINISTRATOR et SUPER_ADMIN : Comptes et Rôles', () => {
    const access = navItemsFor(perms('dashboard:read', 'users:read', 'roles:read')).find((i) => i.label === 'Accès');
    expect(access?.href).toBe('/access/users');
    expect(access?.children?.map((c) => c.label)).toEqual(['Comptes', 'Rôles']);
  });

  it.each([
    ['IT_TECHNICIAN', ['dashboard:read', 'employees:read', 'departments:read']],
    ['HR_MANAGER', ['dashboard:read', 'employees:read', 'employees:write', 'documents:read']],
    ['AUDITOR', ['dashboard:read', 'employees:read', 'documents:read']],
  ])('%s : aucune entrée Accès', (_role, permissions) => {
    expect(navItemsFor(perms(...permissions)).map((i) => i.label)).not.toContain('Accès');
  });
});

describe('rôle principal et règles d’affichage', () => {
  it('priorité alignée sur le backend', () => {
    expect(primaryRole(user(['EMPLOYEE', 'IT_ADMINISTRATOR'], []))).toBe('IT_ADMINISTRATOR');
    expect(primaryRole(user(['AUDITOR'], []))).toBe('AUDITOR');
    expect(primaryRole(user(['IT_TECHNICIAN'], []))).toBe('IT_TECHNICIAN');
  });

  it('écriture employé : SA et HR partout, DM dans son département', () => {
    expect(canWriteEmployee(user(['HR_MANAGER'], ['employees:write']), 'dep-co')).toBe(true);
    expect(canWriteEmployee(user(['DEPARTMENT_MANAGER'], ['employees:write']), 'dep-ac')).toBe(true);
    expect(canWriteEmployee(user(['DEPARTMENT_MANAGER'], ['employees:write']), 'dep-co')).toBe(false);
    expect(canWriteEmployee(user(['IT_ADMINISTRATOR'], ['users:read']), 'dep-ac')).toBe(false);
  });

  it('changement de statut : permission, scope DM, jamais sa propre fiche', () => {
    const hr = user(['HR_MANAGER'], ['employees:status']);
    expect(canChangeEmployeeStatus(hr, { id: 'other', departmentId: 'dep-co' })).toBe(true);
    expect(canChangeEmployeeStatus(hr, { id: 'me', departmentId: 'dep-ac' })).toBe(false);
    const dm = user(['DEPARTMENT_MANAGER'], ['employees:status']);
    expect(canChangeEmployeeStatus(dm, { id: 'other', departmentId: 'dep-co' })).toBe(false);
    expect(canChangeEmployeeStatus(user(['EMPLOYEE'], []), { id: 'other', departmentId: 'dep-ac' })).toBe(false);
  });
});

describe('composants', () => {
  beforeEach(() => mocks.apiFetch.mockReset());

  it('AccountStatusBadge : Actif, Suspendu, Verrouillé', () => {
    render(
      <>
        <AccountStatusBadge status="ACTIVE" />
        <AccountStatusBadge status="SUSPENDED" />
        <AccountStatusBadge status="LOCKED" />
      </>,
    );
    expect(screen.getByText('Actif').className).toContain('bg-success');
    expect(screen.getByText('Suspendu').className).toContain('bg-warning');
    expect(screen.getByText('Verrouillé').className).toContain('bg-error');
  });

  it('Checkbox : libellé visible associé à la case', async () => {
    render(<Checkbox label="Sortie définitive" description="Détail" />);
    await userEvent.click(screen.getByText('Sortie définitive'));
    expect(screen.getByRole('checkbox', { name: /Sortie définitive/ })).toBeChecked();
  });

  it('Suspendre : modale destructive avec l’option « Sortie définitive »', async () => {
    render(<EmployeeStatusActions employee={{ id: 'e', firstName: 'Néné', lastName: 'Bah', employmentStatus: 'ACTIVE' }} />);
    await userEvent.click(screen.getByRole('button', { name: /Suspendre/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/sessions seront fermées/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Sortie définitive/ }));
    expect(within(dialog).getByRole('button', { name: 'Enregistrer la sortie' })).toBeInTheDocument();
  });

  it('Réactiver : précise que le compte reste suspendu', async () => {
    render(<EmployeeStatusActions employee={{ id: 'e', firstName: 'Néné', lastName: 'Bah', employmentStatus: 'SUSPENDED' }} />);
    await userEvent.click(screen.getByRole('button', { name: /Réactiver/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Le compte applicatif reste suspendu');
  });

  const role = (overrides: Partial<RoleDetail> = {}): RoleDetail => ({
    id: 'r',
    name: 'AUDITOR',
    description: 'Auditeur',
    userCount: 1,
    permissionCount: 1,
    permissionIds: ['p1'],
    catalog: [
      { id: 'p1', resource: 'documents', action: 'read', description: null },
      { id: 'p2', resource: 'documents', action: 'write', description: null },
    ],
    editable: true,
    lockedPermissionIds: [],
    ...overrides,
  });

  it('matrice : lecture seule pour l’ITA (aucun bouton, cases désactivées)', () => {
    render(<RolePermissionsEditor role={role({ editable: false })} />);
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).not.toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
  });

  it('matrice : une permission d’un rôle détenu ne peut pas être décochée', () => {
    render(<RolePermissionsEditor role={role({ lockedPermissionIds: ['p1'] })} />);
    expect(screen.getByRole('checkbox', { name: 'documents:read' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'documents:write' })).toBeEnabled();
  });

  it('comptes : seules les actions permises par les capacités sont rendues', async () => {
    const account = (username: string, capabilities: Account['capabilities'], status: Account['status'] = 'ACTIVE'): Account => ({
      id: username,
      username,
      email: `${username}@example.test`,
      displayName: username,
      department: null,
      roles: [{ id: 'r-emp', name: 'EMPLOYEE' }],
      status,
      authProvider: 'LOCAL',
      lastLoginAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      capabilities,
    });
    mocks.apiFetch.mockImplementation(async (path?: string) =>
      String(path).startsWith('/access/roles')
        ? { ok: true, data: [] }
        : {
          ok: true,
          data: {
            data: [
              account('t.balde', { canAssignRoles: false, canChangeStatus: false, canUnlock: false }),
              account('l.sacko', { canAssignRoles: true, canChangeStatus: true, canUnlock: true }, 'LOCKED'),
            ],
            total: 2,
            page: 1,
            limit: 25,
          },
        },
    );
    render(<AccountsList isSuperAdmin={false} />);
    await waitFor(() => expect(screen.getAllByText('l.sacko').length).toBeGreaterThan(0));
    const rows = screen.getAllByRole('row');
    const protectedRow = rows.find((row) => within(row).queryAllByText('t.balde').length > 0)!;
    expect(within(protectedRow).queryAllByRole('button')).toHaveLength(0);
    const lockedRow = rows.find((row) => within(row).queryAllByText('l.sacko').length > 0)!;
    expect(within(lockedRow).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rôles', 'Déverrouiller', 'Suspendre']);
  });
});
