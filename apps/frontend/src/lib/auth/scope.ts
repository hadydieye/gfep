import type { AuthUser } from '@/lib/api/types';
import { primaryRole } from './session';

/** Département imposé aux écritures d'un DEPARTMENT_MANAGER, null pour un SUPER_ADMIN. */
export function writeScopeDepartmentId(user: AuthUser): string | null {
  return primaryRole(user) === 'DEPARTMENT_MANAGER' ? (user.employee?.departmentId ?? null) : null;
}

/** Miroir côté UI des règles backend : affichage des actions d'écriture sur un employé. */
export function canWriteEmployee(user: AuthUser, departmentId: string): boolean {
  const role = primaryRole(user);
  if (role === 'SUPER_ADMIN') return true;
  return role === 'DEPARTMENT_MANAGER' && user.employee?.departmentId === departmentId;
}
