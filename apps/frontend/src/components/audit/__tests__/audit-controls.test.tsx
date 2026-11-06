import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentHistory } from '@/components/documents/document-history';
import { navItemsFor } from '@/components/layout/nav-items';
import { Tabs } from '@/components/ui/tabs';
import type { AuditLogItem } from '@/lib/api/types';
import { AuditConsole } from '../audit-console';
import { SeverityBadge } from '../audit-labels';

// Routeur stable, comme celui de Next.js
const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock('@/lib/api/client', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router, usePathname: () => '/admin/audit' }));

const perms = (...keys: string[]) => keys.map((key) => ({ resource: key.split(':')[0], action: key.split(':')[1] }));

const log: AuditLogItem = {
  id: 'l1',
  actor: { id: 'u1', username: 'f.camara' },
  action: 'employee.update',
  resourceType: 'Employee',
  resourceId: 'e1',
  oldValues: { phone: null },
  newValues: { phone: '+224620001122' },
  sourceIp: '10.0.0.5',
  timestamp: '2026-11-06T10:00:00.000Z',
};

beforeEach(() => mocks.apiFetch.mockReset());

describe('entrée « Audit » de la sidebar (design §8.4)', () => {
  it('visible avec audit:read (SA, AUD) ; absente pour l’ITA (M21)', () => {
    expect(navItemsFor(perms('dashboard:read', 'audit:read')).map((i) => i.href)).toContain('/admin/audit');
    expect(navItemsFor(perms('dashboard:read', 'users:read', 'roles:read')).map((i) => i.label)).not.toContain('Audit');
  });
});

describe('onglets', () => {
  function Harness() {
    const [value, setValue] = useState('a');
    return (
      <Tabs items={[{ value: 'a', label: 'Un' }, { value: 'b', label: 'Deux' }, { value: 'c', label: 'Trois' }]} value={value} onValueChange={setValue} label="Test">
        <p>Panneau {value}</p>
      </Tabs>
    );
  }

  it('navigation au clavier : flèches, Début, Fin ; un seul onglet focalisable', async () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    tabs[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Deux' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panneau b');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Trois' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Un' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('console /admin/audit', () => {
  it('journal : libellés français, panneau de détail avant/après au clic', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, data: { data: [log], total: 1, page: 1, limit: 25 } });
    render(<AuditConsole canReadSecurityEvents />);
    const row = await screen.findByRole('cell', { name: 'Modification d’employé' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Journal d’activité', 'Événements de sécurité', 'Authentifications']);
    await userEvent.click(row);
    const detail = screen.getByRole('region', { name: 'Détail de l’entrée' });
    expect(within(detail).getByText('Avant')).toBeInTheDocument();
    expect(within(detail).getByText('+224620001122')).toBeInTheDocument();
  });

  it('filtre « Action » transmis à l’API, page remise à 1', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, data: { data: [log], total: 1, page: 1, limit: 25 } });
    render(<AuditConsole canReadSecurityEvents />);
    await screen.findByRole('cell', { name: 'Modification d’employé' });
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'role.assign');
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenLastCalledWith('/audit/logs?page=1&limit=25&action=role.assign'));
  });

  it('403 rendu pour un rôle sans accès (ITA)', async () => {
    mocks.apiFetch.mockResolvedValue({ ok: false, status: 403 });
    render(<AuditConsole canReadSecurityEvents={false} />);
    expect(await screen.findByText('Vous n\'avez pas accès à cette section.')).toBeInTheDocument();
  });

  it('sévérités : Moyenne (attention), Élevée et Critique (erreur)', () => {
    render(
      <>
        <SeverityBadge severity="MEDIUM" />
        <SeverityBadge severity="HIGH" />
        <SeverityBadge severity="CRITICAL" />
      </>,
    );
    expect(screen.getByText('Moyenne').className).toContain('bg-warning');
    expect(screen.getByText('Élevée').className).toContain('bg-error');
    expect(screen.getByText('Critique').className).toContain('bg-error');
  });
});

describe('historique de consultation', () => {
  it('liste les consultations journalisées', async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      data: [{ id: 'h1', action: 'document.download', actor: { id: 'u', username: 's.toure' }, sourceIp: '10.0.0.9', timestamp: '2026-11-06T09:00:00.000Z' }],
    });
    render(<DocumentHistory documentId="d1" />);
    expect(await screen.findByText('Téléchargement de document')).toBeInTheDocument();
    expect(screen.getByText('par s.toure')).toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledWith('/documents/d1/history');
  });
});
