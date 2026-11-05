import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

export const SUPER_ADMIN = 'SUPER_ADMIN';
export const DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER';
export const EMPLOYEE = 'EMPLOYEE';

// Rôle le plus élevé de l'utilisateur, utilisé pour le scoping des vues
export function primaryRole(user: AuthenticatedUser): string {
  for (const role of [SUPER_ADMIN, DEPARTMENT_MANAGER, EMPLOYEE]) {
    if (user.roles.includes(role)) return role;
  }
  return EMPLOYEE;
}

/**
 * Department Manager Scope : retourne le département auquel les écritures sont
 * restreintes, ou null si l'utilisateur n'est pas restreint (SUPER_ADMIN).
 */
export function writeScopeDepartmentId(user: AuthenticatedUser): string | null {
  if (primaryRole(user) !== DEPARTMENT_MANAGER) return null;
  if (!user.employeeIdentity) throw new ForbiddenException();
  return user.employeeIdentity.departmentId;
}
