import { Badge } from '@/components/ui/badge';
import type { AuthProvider, RoleName, UserStatus } from '@/lib/api/types';

export const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: 'Super Admin',
  IT_ADMINISTRATOR: 'Administrateur IT',
  IT_TECHNICIAN: 'Technicien IT',
  HR_MANAGER: 'Responsable RH',
  ACCOUNTANT: 'Comptable',
  DEPARTMENT_MANAGER: 'Responsable de département',
  EMPLOYEE: 'Employé',
  AUDITOR: 'Auditeur',
};

export const ACCOUNT_STATUS: Record<UserStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  ACTIVE: { label: 'Actif', variant: 'success' },
  SUSPENDED: { label: 'Suspendu', variant: 'warning' },
  LOCKED: { label: 'Verrouillé', variant: 'error' },
};

export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  LOCAL: 'Local',
  ACTIVE_DIRECTORY: 'Active Directory',
};

// Libellés des ressources de la matrice des permissions
export const RESOURCE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  employees: 'Employés',
  departments: 'Départements',
  documents: 'Documents',
  transactions: 'Transactions',
  invoices: 'Factures',
  roles: 'Rôles',
  users: 'Comptes',
};

export function roleLabel(name: string): string {
  return ROLE_LABELS[name as RoleName] ?? name;
}

export function AccountStatusBadge({ status }: { status: UserStatus }) {
  const badge = ACCOUNT_STATUS[status];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

export function RoleBadge({ name }: { name: string }) {
  return <Badge variant="neutral">{roleLabel(name)}</Badge>;
}
