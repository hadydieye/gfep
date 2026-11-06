import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { navItemsFor } from '@/components/layout/nav-items';
import type { Invoice } from '@/lib/api/types';
import { InvoiceStatusBadge, TransactionStatusBadge } from '../finance-badges';
import { InvoiceDetail } from '../invoice-detail';
import { MoneyAmount, formatMoney } from '../money-amount';
import { normalizeAmount, transactionSchema } from '../transaction-form';

vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const permissions = (...keys: string[]) =>
  keys.map((key) => {
    const [resource, action] = key.split(':');
    return { resource, action };
  });

// Permissions du seed à l'étape 2.3 (gfep-mvp2/DECISIONS.md M24)
const BASE = ['dashboard:read', 'employees:read', 'departments:read', 'documents:read'];
const ROLE_PERMISSIONS = {
  EMPLOYEE: permissions(...BASE),
  DEPARTMENT_MANAGER: permissions(...BASE, 'transactions:read', 'invoices:read'),
  ACCOUNTANT: permissions(...BASE, 'transactions:read', 'transactions:write', 'invoices:read', 'invoices:status'),
  SUPER_ADMIN: permissions(
    ...BASE,
    'transactions:read',
    'transactions:write',
    'transactions:validate',
    'invoices:read',
    'invoices:status',
  ),
};

const invoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'invoice-1',
  invoiceNumber: 'FAC-2026-0001',
  clientName: 'Kaloum Distribution SARL',
  amount: '2500000.00',
  currency: 'GNF',
  dueDate: '2026-12-28T00:00:00.000Z',
  status: 'SENT',
  createdAt: '2026-11-01T00:00:00.000Z',
  department: { id: 'dep', name: 'Commercial', code: 'CO' },
  createdBy: { id: 'u', username: 'm.keita' },
  allowedTransitions: ['PAID', 'OVERDUE', 'CANCELLED'],
  ...overrides,
});

describe('menu Finance (critère de passage 2.3)', () => {
  it('EMPLOYEE : aucune entrée Finance', () => {
    const labels = navItemsFor(ROLE_PERMISSIONS.EMPLOYEE).map((item) => item.label);
    expect(labels).not.toContain('Finance');
    expect(labels).toEqual(['Tableau de bord', 'Employés', 'Départements', 'Documents']);
  });

  it.each(['DEPARTMENT_MANAGER', 'ACCOUNTANT', 'SUPER_ADMIN'] as const)(
    '%s : entrée Finance avec Transactions et Factures',
    (role) => {
      const finance = navItemsFor(ROLE_PERMISSIONS[role]).find((item) => item.label === 'Finance');
      expect(finance?.href).toBe('/finance/transactions');
      expect(finance?.children?.map((child) => child.href)).toEqual(['/finance/transactions', '/finance/invoices']);
    },
  );

  it('une seule permission de lecture suffit, sans sous-lien inaccessible', () => {
    const finance = navItemsFor(permissions('invoices:read')).find((item) => item.label === 'Finance');
    expect(finance?.href).toBe('/finance/invoices');
    expect(finance?.children?.map((child) => child.label)).toEqual(['Factures']);
  });
});

describe('badges de statut', () => {
  it('transactions et factures : libellés français', () => {
    render(
      <>
        <TransactionStatusBadge status="PENDING" />
        <TransactionStatusBadge status="VALIDATED" />
        <TransactionStatusBadge status="REJECTED" />
        <InvoiceStatusBadge status="DRAFT" />
        <InvoiceStatusBadge status="PAID" />
        <InvoiceStatusBadge status="OVERDUE" />
        <InvoiceStatusBadge status="CANCELLED" />
      </>,
    );
    for (const label of ['Validée', 'Rejetée', 'Brouillon', 'Payée', 'En retard', 'Annulée']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('En attente')).toHaveLength(1);
  });

  it('variantes sémantiques : attente, succès, erreur', () => {
    const { container } = render(
      <>
        <TransactionStatusBadge status="PENDING" />
        <TransactionStatusBadge status="VALIDATED" />
        <InvoiceStatusBadge status="OVERDUE" />
      </>,
    );
    const badges = container.querySelectorAll(':scope > span');
    expect(badges[0].className).toContain('bg-warning');
    expect(badges[1].className).toContain('bg-success');
    expect(badges[2].className).toContain('bg-error');
  });
});

describe('MoneyAmount (fr-FR, sans flottant)', () => {
  const NBSP = ' ';
  const strip = (value: string) => value.replace(/[  ]/g, ' ');

  it('groupe les milliers et affiche la devise', () => {
    expect(strip(formatMoney('2500000.00'))).toBe('2 500 000 GNF');
    expect(strip(formatMoney('1500000.50'))).toBe('1 500 000,50 GNF');
    expect(formatMoney('12.5')).toBe(`12,50${NBSP}GNF`);
  });

  it('conserve exactement les grands montants (aucune perte de précision)', () => {
    expect(strip(formatMoney('999999999999.99'))).toBe('999 999 999 999,99 GNF');
    expect(strip(formatMoney('9007199254740993.01'))).toBe('9 007 199 254 740 993,01 GNF');
  });

  it('rendu en chiffres tabulaires', () => {
    render(<MoneyAmount amount="1000.00" />);
    expect(screen.getByText(/GNF/).className).toContain('tabular-nums');
  });
});

describe('formulaire de transaction', () => {
  const valid = { transactionType: 'INCOME', departmentId: '0b9f6f4e-8d6a-4c1e-9a43-2f8f6f0d9a11' };

  it('normalise la saisie française en chaîne décimale', () => {
    expect(normalizeAmount('1 500 000,50')).toBe('1500000.50');
    expect(transactionSchema.parse({ ...valid, amount: '1 500,5' }).amount).toBe('1500.5');
  });

  it.each(['0', '0,00', '-5', '1,234', 'abc', '1000000000000'])('refuse le montant « %s »', (amount) => {
    expect(transactionSchema.safeParse({ ...valid, amount }).success).toBe(false);
  });
});

describe('fiche facture', () => {
  it('le sélecteur ne propose que les transitions autorisées', () => {
    render(<InvoiceDetail invoice={invoice()} />);
    const select = screen.getByLabelText('Nouveau statut');
    const options = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Sélectionnez un statut', 'Payée', 'En retard', 'Annulée']);
    expect(screen.getByRole('button', { name: /Changer le statut/ })).toBeDisabled();
  });

  it('lecture seule sans transition autorisée (DM, ou facture finale)', () => {
    render(<InvoiceDetail invoice={invoice({ allowedTransitions: [] })} />);
    expect(screen.queryByLabelText('Nouveau statut')).not.toBeInTheDocument();
    expect(screen.getByText('Kaloum Distribution SARL')).toBeInTheDocument();
  });
});
