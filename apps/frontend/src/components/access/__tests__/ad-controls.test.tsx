import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_UNAVAILABLE_MESSAGE, LoginForm, adLoginErrorMessage } from '@/components/auth/login-form';
import { ServiceStatusCard } from '@/components/dashboard/service-status-card';
import { navItemsFor } from '@/components/layout/nav-items';
import { AdMappingsManager } from '../ad-mappings-manager';

// Routeur stable, comme celui de Next.js
const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, usePathname: () => '/access/ad-mappings' }));

const perms = (...keys: string[]) => keys.map((key) => ({ resource: key.split(':')[0], action: key.split(':')[1] }));

beforeEach(() => {
  mocks.apiFetch.mockReset();
  mocks.router.push.mockReset();
});

describe('/login/ad (AppFlow §3.2, R33)', () => {
  it('messages : 503 annuaire injoignable (distinct), 401 générique, 429, réseau', () => {
    expect(adLoginErrorMessage(503)).toBe(AD_UNAVAILABLE_MESSAGE);
    expect(adLoginErrorMessage(401)).toBe('Identifiants invalides.');
    expect(adLoginErrorMessage(429)).toBe('Trop de tentatives. Réessayez dans quelques minutes.');
    expect(adLoginErrorMessage(0)).toBe('Service momentanément indisponible. Réessayez.');
  });

  it('envoie les identifiants à /auth/login-ad et affiche le message AD sur 503', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: false, status: 503 });
    render(<LoginForm endpoint="/auth/login-ad" errorMessage={adLoginErrorMessage} />);
    await userEvent.type(screen.getByLabelText('Identifiant'), 'ad.fofana');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(AD_UNAVAILABLE_MESSAGE);
    expect(mocks.apiFetch).toHaveBeenCalledWith('/auth/login-ad', expect.objectContaining({ method: 'POST' }));
  });

  it('succès : redirection vers le tableau de bord', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, data: {} });
    render(<LoginForm endpoint="/auth/login-ad" errorMessage={adLoginErrorMessage} />);
    await userEvent.type(screen.getByLabelText('Identifiant'), 'ad.fofana');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith('/dashboard'));
  });
});

describe('« État des services » : annuaire LDAP', () => {
  it.each([
    ['UP', 'Disponible', 'bg-success'],
    ['DOWN', 'Indisponible', 'bg-error'],
    ['NOT_CONFIGURED', 'Non configuré', 'bg-border'],
  ] as const)('%s → %s', (ldap, label, className) => {
    render(<ServiceStatusCard services={{ database: 'UP', ldap }} />);
    const row = screen.getByText('Annuaire LDAP').closest('li')!;
    const badge = within(row).getByText(label);
    expect(badge.className).toContain(className);
  });
});

describe('/access/ad-mappings (M22)', () => {
  it('entrée « Mappings AD » du menu Accès pour ad_mappings:read', () => {
    const access = navItemsFor(perms('users:read', 'roles:read', 'ad_mappings:read')).find((i) => i.label === 'Accès');
    expect(access?.children?.map((c) => c.label)).toEqual(['Comptes', 'Rôles', 'Mappings AD']);
    expect(navItemsFor(perms('dashboard:read')).map((i) => i.label)).not.toContain('Accès');
  });

  const setup = (isSuperAdmin: boolean) => {
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path === '/access/roles') {
        return {
          ok: true,
          data: [
            { id: 'r-sa', name: 'SUPER_ADMIN', description: null, userCount: 1, permissionCount: 30 },
            { id: 'r-emp', name: 'EMPLOYEE', description: null, userCount: 30, permissionCount: 9 },
          ],
        };
      }
      return {
        ok: true,
        data: [
          { id: 'm1', adGroupDn: 'cn=GFEP-SuperAdmins,ou=Informatique,dc=gnpaytrust,dc=local', role: { id: 'r-sa', name: 'SUPER_ADMIN' } },
          { id: 'm2', adGroupDn: 'cn=GFEP-Employes,ou=Informatique,dc=gnpaytrust,dc=local', role: { id: 'r-emp', name: 'EMPLOYEE' } },
        ],
      };
    });
    render(<AdMappingsManager isSuperAdmin={isSuperAdmin} />);
  };

  it('IT_ADMINISTRATOR : rôle Super Admin non sélectionnable, mapping Super Admin non supprimable', async () => {
    setup(false);
    await screen.findByText('cn=GFEP-SuperAdmins,ou=Informatique,dc=gnpaytrust,dc=local');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Super Admin' })).toBeDisabled());
    const rows = screen.getAllByRole('row');
    const superAdminRow = rows.find((r) => within(r).queryByText(/GFEP-SuperAdmins/))!;
    expect(within(superAdminRow).queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument();
    const employeeRow = rows.find((r) => within(r).queryByText(/GFEP-Employes/))!;
    expect(within(employeeRow).getByRole('button', { name: /Supprimer/ })).toBeInTheDocument();
  });

  it('SUPER_ADMIN : tout est gérable', async () => {
    setup(true);
    await screen.findByText('cn=GFEP-SuperAdmins,ou=Informatique,dc=gnpaytrust,dc=local');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Super Admin' })).toBeEnabled());
    expect(screen.getAllByRole('button', { name: /Supprimer/ })).toHaveLength(2);
  });

  it('DN invalide : message sous le champ, aucun appel', async () => {
    setup(true);
    await screen.findByText(/GFEP-Employes/);
    await userEvent.type(screen.getByLabelText('DN du groupe'), 'pas un DN');
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'r-emp');
    await userEvent.click(screen.getByRole('button', { name: /Ajouter/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Saisissez un DN de groupe valide');
    expect(mocks.apiFetch).not.toHaveBeenCalledWith('/access/ad-mappings', expect.objectContaining({ method: 'POST' }));
  });
});
