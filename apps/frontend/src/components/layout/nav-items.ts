import { Building2, FileText, LayoutDashboard, ShieldCheck, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Permissions = Array<{ resource: string; action: string }>;

export interface NavLink {
  href: string;
  label: string;
  resource: string;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Sous-liens ; l'entrée n'apparaît que si au moins l'un d'eux est accessible */
  children?: NavLink[];
}

const NAV_DEFINITIONS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  resource?: string;
  children?: NavLink[];
}> = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, resource: 'dashboard' },
  { href: '/employees', label: 'Employés', icon: Users, resource: 'employees' },
  { href: '/departments', label: 'Départements', icon: Building2, resource: 'departments' },
  { href: '/documents', label: 'Documents', icon: FileText, resource: 'documents' },
  {
    href: '/finance',
    label: 'Finance',
    icon: Wallet,
    children: [
      { href: '/finance/transactions', label: 'Transactions', resource: 'transactions' },
      { href: '/finance/invoices', label: 'Factures', resource: 'invoices' },
    ],
  },
  {
    href: '/access',
    label: 'Accès',
    icon: ShieldCheck,
    children: [
      { href: '/access/users', label: 'Comptes', resource: 'users' },
      { href: '/access/roles', label: 'Rôles', resource: 'roles' },
    ],
  },
];

const canRead = (permissions: Permissions, resource: string) =>
  permissions.some((p) => p.resource === resource && p.action === 'read');

/**
 * Entrées de navigation filtrées par permission de lecture : aucune entrée
 * désactivée n'est affichée. Une entrée à sous-liens pointe vers son premier
 * sous-lien accessible.
 */
export function navItemsFor(permissions: Permissions): NavItem[] {
  return NAV_DEFINITIONS.flatMap(({ href, label, icon, resource, children }): NavItem[] => {
    if (!children) return resource && canRead(permissions, resource) ? [{ href, label, icon }] : [];
    const visible = children.filter((child) => canRead(permissions, child.resource));
    return visible.length > 0 ? [{ href: visible[0].href, label, icon, children: visible }] : [];
  });
}
