import { ForbiddenException } from '@nestjs/common';
import { InvoiceStatus, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { financeScopeDepartmentId } from '../rbac/roles.js';
import { AMOUNT_PATTERN } from './dto/create-transaction.dto.js';
import { dateRange } from './finance-common.js';
import { INVOICE_TRANSITIONS, canTransitionInvoice } from './invoice-transitions.js';
import { referenceAfter, transactionReferencePrefix } from './transaction-reference.js';

const user = (roles: string[], departmentId: string | null = 'dep-1'): AuthenticatedUser => ({
  id: 'u',
  sessionId: 's',
  username: 'u',
  email: 'u@example.test',
  status: UserStatus.ACTIVE,
  roles,
  permissions: [],
  employeeIdentity: departmentId ? { employeeId: 'e', departmentId } : null,
});

describe('Transitions de facture (M14)', () => {
  const allowed: Array<[InvoiceStatus, InvoiceStatus]> = [
    ['DRAFT', 'SENT'],
    ['DRAFT', 'CANCELLED'],
    ['SENT', 'PAID'],
    ['SENT', 'OVERDUE'],
    ['SENT', 'CANCELLED'],
    ['OVERDUE', 'PAID'],
    ['OVERDUE', 'CANCELLED'],
  ];

  it('autorise exactement les 7 transitions de M14', () => {
    const all = Object.values(InvoiceStatus).flatMap((from) =>
      Object.values(InvoiceStatus).map((to) => [from, to] as [InvoiceStatus, InvoiceStatus]),
    );
    const permitted = all.filter(([from, to]) => canTransitionInvoice(from, to));
    expect(permitted).toEqual(expect.arrayContaining(allowed));
    expect(permitted).toHaveLength(allowed.length);
  });

  it('PAID et CANCELLED sont finaux', () => {
    expect(INVOICE_TRANSITIONS.PAID).toEqual([]);
    expect(INVOICE_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('refuse une transition vers le même statut', () => {
    for (const status of Object.values(InvoiceStatus)) {
      expect(canTransitionInvoice(status, status)).toBe(false);
    }
  });
});

describe('Référence de transaction TRX-{AAAA}-{NNNNN}', () => {
  it('prend le plus grand suffixe numérique de l’année + 1, sans réutiliser les trous', () => {
    const prefix = transactionReferencePrefix(2026);
    expect(prefix).toBe('TRX-2026-');
    expect(referenceAfter(prefix, [])).toBe('TRX-2026-00001');
    expect(referenceAfter(prefix, ['TRX-2026-00001', 'TRX-2026-00007', 'TRX-2026-00003'])).toBe(
      'TRX-2026-00008',
    );
    expect(referenceAfter(prefix, ['TRX-2026-00100', 'TRX-2026-ABCDE'])).toBe('TRX-2026-00101');
  });
});

describe('Montant (chaîne décimale, jamais un flottant)', () => {
  it.each(['1', '0.01', '150000', '150000.5', '150000.50', '999999999999.99'])('accepte %s', (value) => {
    expect(AMOUNT_PATTERN.test(value)).toBe(true);
  });

  it.each(['0', '0.00', '-5', '1.234', '1e5', '1 000', '1,50', '01', '1000000000000', '.5', '', 'abc'])(
    'refuse %s',
    (value) => {
      expect(AMOUNT_PATTERN.test(value)).toBe(false);
    },
  );
});

describe('Scope de lecture finance (M13)', () => {
  it('SUPER_ADMIN et ACCOUNTANT voient tout', () => {
    expect(financeScopeDepartmentId(user(['SUPER_ADMIN']))).toBeNull();
    expect(financeScopeDepartmentId(user(['ACCOUNTANT']))).toBeNull();
  });

  it('DEPARTMENT_MANAGER limité à son département', () => {
    expect(financeScopeDepartmentId(user(['DEPARTMENT_MANAGER'], 'dep-rh'))).toBe('dep-rh');
  });

  it('DEPARTMENT_MANAGER sans fiche employé, ou tout autre rôle : refus', () => {
    expect(() => financeScopeDepartmentId(user(['DEPARTMENT_MANAGER'], null))).toThrow(ForbiddenException);
    expect(() => financeScopeDepartmentId(user(['EMPLOYEE']))).toThrow(ForbiddenException);
  });
});

describe('Filtre de période', () => {
  it('borne supérieure incluse : jusqu’à la fin du jour', () => {
    expect(dateRange('2026-03-01', '2026-03-31')).toEqual({
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lt: new Date('2026-04-01T00:00:00.000Z'),
    });
    expect(dateRange()).toBeUndefined();
  });
});
