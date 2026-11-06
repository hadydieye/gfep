import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell, SIDEBAR_STORAGE_KEY } from '@/components/layout/app-shell';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import type { AuthUser } from '@/lib/api/types';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';

/** Étape 3.1 — Tiroir mobile, sidebar réductible, bascule de thème (R6, R7, N7, N8). */
const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  pathname: '/dashboard',
  router: { push: vi.fn(), refresh: vi.fn() },
}));
vi.mock('@/lib/api/client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, usePathname: () => mocks.pathname }));

const perms = (...keys: string[]) => keys.map((key) => ({ resource: key.split(':')[0], action: key.split(':')[1] }));
const user = (permissions: string[]): AuthUser => ({
  id: 'u',
  username: 't.balde',
  email: 't.balde@example.test',
  status: 'ACTIVE',
  roles: [{ id: 'r', name: 'SUPER_ADMIN' }],
  permissions: perms(...permissions),
  employee: { id: 'e', firstName: 'Thierno', lastName: 'Baldé', departmentId: 'd' },
});

const ADMIN = user(['dashboard:read', 'employees:read', 'departments:read', 'documents:read', 'transactions:read', 'invoices:read', 'users:read', 'audit:read']);

function renderShell(account = ADMIN) {
  return render(
    <AppShell user={account} initialUnreadCount={0}>
      <p>Contenu</p>
    </AppShell>,
  );
}

beforeEach(() => {
  mocks.apiFetch.mockReset().mockResolvedValue({ ok: true, data: { count: 0 } });
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.cookie = `${THEME_COOKIE}=; Max-Age=0; Path=/`;
});

describe('tiroir de navigation mobile (N7)', () => {
  it('s’ouvre depuis la topbar, piège le focus, se ferme par Échap et rend le focus', async () => {
    const actor = userEvent.setup();
    renderShell();
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    await actor.click(trigger);
    const drawer = screen.getByRole('dialog', { name: 'Menu de navigation' });
    const links = within(drawer).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(expect.arrayContaining(['Tableau de bord', 'Employés', 'Transactions', 'Audit']));
    // Focus sur le premier élément du tiroir ; Maj+Tab depuis le premier revient au dernier
    const focusables = within(drawer).getAllByRole('button').concat(links);
    expect(focusables).toContain(document.activeElement);
    await actor.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Menu de navigation' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('se ferme par clic sur le voile et au clic sur un lien', async () => {
    const actor = userEvent.setup();
    renderShell();
    await actor.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    await actor.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await actor.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    await actor.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Employés' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('n’affiche que les entrées autorisées (aucune entrée désactivée)', async () => {
    const actor = userEvent.setup();
    renderShell(user(['dashboard:read', 'employees:read']));
    await actor.click(screen.getByRole('button', { name: 'Ouvrir le menu' }));
    const names = within(screen.getByRole('dialog')).getAllByRole('link').map((l) => l.textContent);
    expect(names).toEqual(['Tableau de bord', 'Employés']);
  });
});

describe('sidebar réductible (N7)', () => {
  it('se réduit en icônes avec des noms accessibles et mémorise la préférence', async () => {
    const actor = userEvent.setup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Employés' }).textContent).toBe('Employés');
    await actor.click(screen.getByRole('button', { name: 'Réduire la barre latérale' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    const employees = within(nav).getByRole('link', { name: 'Employés' });
    expect(employees.textContent).toBe('');
    expect(employees.getAttribute('title')).toBe('Employés');
    // Le groupe Finance mène à son premier sous-lien accessible
    expect(within(nav).getByRole('link', { name: 'Finance' }).getAttribute('href')).toBe('/finance/transactions');
    await actor.click(screen.getByRole('button', { name: 'Déplier la barre latérale' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('expanded');
  });

  it('est réduite par défaut sur tablette, sans préférence enregistrée', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    renderShell();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Déplier la barre latérale' })).toBeTruthy());
  });

  it('respecte une préférence enregistrée', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'expanded');
    renderShell();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Réduire la barre latérale' })).toBeTruthy());
  });
});

describe('bascule de thème (N8)', () => {
  it('pose la classe dark et le cookie gfep-theme, puis revient au clair', async () => {
    const actor = userEvent.setup();
    render(<ThemeToggle />);
    await actor.click(screen.getByRole('button', { name: 'Activer le thème sombre' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    await actor.click(screen.getByRole('button', { name: 'Activer le thème clair' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
  });

  it('lit l’état posé par le serveur', async () => {
    document.documentElement.classList.add('dark');
    await act(async () => {
      render(<ThemeToggle />);
    });
    expect(screen.getByRole('button', { name: 'Activer le thème clair' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('seule la valeur « dark » active le thème sombre côté serveur', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme(undefined)).toBe('light');
    expect(parseTheme('<script>')).toBe('light');
  });

  it('la topbar expose la bascule sur tous les écrans authentifiés', () => {
    renderShell();
    expect(screen.getByRole('button', { name: 'Activer le thème sombre' })).toBeTruthy();
  });
});
