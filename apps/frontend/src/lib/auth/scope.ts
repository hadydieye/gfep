import type { AuthUser } from '@/lib/api/types';
import { hasPermission, hasRole } from './session';

/** Département imposé aux écritures d'un DEPARTMENT_MANAGER, null pour SUPER_ADMIN et HR_MANAGER. */
export function writeScopeDepartmentId(user: AuthUser): string | null {
  if (hasRole(user, 'SUPER_ADMIN', 'HR_MANAGER')) return null;
  return hasRole(user, 'DEPARTMENT_MANAGER') ? (user.employee?.departmentId ?? null) : null;
}

/** Miroir côté UI des règles backend : affichage des actions d'écriture sur un employé. */
export function canWriteEmployee(user: AuthUser, departmentId: string): boolean {
  if (!hasPermission(user, 'employees', 'write')) return false;
  if (hasRole(user, 'SUPER_ADMIN', 'HR_MANAGER')) return true;
  return hasRole(user, 'DEPARTMENT_MANAGER') && user.employee?.departmentId === departmentId;
}

/**
 * Affichage de « Suspendre » / « Réactiver » (M16) : permission employees:status,
 * scope DM, jamais sur sa propre fiche. Le serveur fait foi (garde-fous M17 inclus).
 */
export function canChangeEmployeeStatus(user: AuthUser, employee: { id: string; departmentId: string }): boolean {
  if (!hasPermission(user, 'employees', 'status') || user.employee?.id === employee.id) return false;
  if (hasRole(user, 'SUPER_ADMIN', 'HR_MANAGER')) return true;
  return hasRole(user, 'DEPARTMENT_MANAGER') && user.employee?.departmentId === employee.departmentId;
}
