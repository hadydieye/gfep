import { Building2, LayoutDashboard, Users } from 'lucide-react';

// Entrées de navigation, filtrées par permission de lecture
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, resource: 'dashboard' },
  { href: '/employees', label: 'Employés', icon: Users, resource: 'employees' },
  { href: '/departments', label: 'Départements', icon: Building2, resource: 'departments' },
] as const;

export function navItemsFor(permissions: Array<{ resource: string; action: string }>) {
  return NAV_ITEMS.filter((item) =>
    permissions.some((p) => p.resource === item.resource && p.action === 'read'),
  );
}
