import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamTable } from '@/components/departments/team-table';
import { EmployeesList } from '@/components/employees/employees-list';
import type { Employee, PaginatedEmployees } from '@/lib/api/types';

/** Étape 3.1 — Tri par colonne (R3, N6) et vue en cartes mobile des employés (R1.3). */
const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, usePathname: () => '/employees' }));

const employee = (id: string, firstName: string, lastName: string): Employee =>
  ({
    id,
    employeeNumber: `GF-2026-${id}`,
    firstName,
    lastName,
    professionalEmail: `${id}@example.test`,
    phone: null,
    departmentId: 'd',
    department: { id: 'd', name: 'Informatique', code: 'IT' },
    position: { id: 'p', title: 'Technicien support' },
    manager: null,
    hireDate: '2024-03-01T00:00:00.000Z',
    employmentStatus: 'ACTIVE',
  }) as unknown as Employee;

const page = (data: Employee[]): PaginatedEmployees => ({ data, total: data.length, page: 1, limit: 25 });

const employeeCalls = () =>
  mocks.apiFetch.mock.calls.map(([path]) => path as string).filter((path) => path.startsWith('/employees?'));

beforeEach(() => {
  mocks.apiFetch.mockReset().mockImplementation(async (path: string) =>
    path.startsWith('/departments') ? { ok: true, data: [] } : { ok: true, data: page([employee('001', 'Awa', 'Bah')]) },
  );
  window.history.replaceState(null, '', '/employees');
});

describe('liste des employés : tri côté serveur', () => {
  it('un clic sur un en-tête envoie sort/order, inverse au second clic, et met à jour l’URL', async () => {
    const actor = userEvent.setup();
    render(<EmployeesList canCreate={false} />);
    await screen.findAllByText('Awa Bah');
    const header = screen.getByRole('button', { name: /Date d'embauche/ });
    await actor.click(header);
    await waitFor(() => expect(employeeCalls().at(-1)).toContain('sort=hireDate&order=asc'));
    expect(window.location.search).toContain('sort=hireDate&order=asc');
    expect(header.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
    await actor.click(header);
    await waitFor(() => expect(employeeCalls().at(-1)).toContain('sort=hireDate&order=desc'));
    expect(header.closest('th')?.getAttribute('aria-sort')).toBe('descending');
    // Toujours la page 1 après un changement de tri
    expect(employeeCalls().at(-1)).toContain('page=1');
  });

  it('reprend le tri présent dans l’URL dès le premier chargement (une seule requête)', async () => {
    window.history.replaceState(null, '', '/employees?sort=department&order=desc');
    render(<EmployeesList canCreate={false} />);
    await screen.findAllByText('Awa Bah');
    expect(employeeCalls()).toHaveLength(1);
    expect(employeeCalls()[0]).toContain('sort=department&order=desc');
  });

  it('ignore une clé de tri inconnue dans l’URL', async () => {
    window.history.replaceState(null, '', '/employees?sort=passwordHash');
    render(<EmployeesList canCreate={false} />);
    await screen.findAllByText('Awa Bah');
    expect(employeeCalls()[0]).not.toContain('sort=');
  });

  it('propose un sélecteur de tri et des cartes empilées pour le mobile', async () => {
    const actor = userEvent.setup();
    render(<EmployeesList canCreate={false} />);
    const cards = await screen.findByTestId('employees-cards');
    expect(cards.querySelector('a[href="/employees/001"]')?.textContent).toContain('Awa Bah');
    await actor.selectOptions(screen.getByLabelText('Trier par'), 'lastName:desc');
    await waitFor(() => expect(employeeCalls().at(-1)).toContain('sort=lastName&order=desc'));
  });
});

describe('équipe d’un département : tri côté client', () => {
  it('trie par nom, puis inverse', async () => {
    const actor = userEvent.setup();
    const members = [
      { id: '1', employeeNumber: 'A', firstName: 'Zoé', lastName: 'Camara', position: 'Comptable', employmentStatus: 'ACTIVE' as const },
      { id: '2', employeeNumber: 'B', firstName: 'Ali', lastName: 'Baldé', position: 'Auditeur', employmentStatus: 'ACTIVE' as const },
    ];
    render(<TeamTable employees={members} />);
    const names = () => screen.getAllByRole('link').map((l) => l.textContent);
    expect(names()).toEqual(['Zoé Camara', 'Ali Baldé']);
    await actor.click(screen.getByRole('button', { name: /^Nom/ }));
    expect(names()).toEqual(['Ali Baldé', 'Zoé Camara']);
    await actor.click(screen.getByRole('button', { name: /^Nom/ }));
    expect(names()).toEqual(['Zoé Camara', 'Ali Baldé']);
  });
});
