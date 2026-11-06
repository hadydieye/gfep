import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

export const SUPER_ADMIN = 'SUPER_ADMIN';
export const DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER';
export const EMPLOYEE = 'EMPLOYEE';
export const ACCOUNTANT = 'ACCOUNTANT';

// Routes ouvertes en lecture à tous les rôles existants (dashboard, employés, départements)
export const READ_ROLES = [SUPER_ADMIN, DEPARTMENT_MANAGER, ACCOUNTANT, EMPLOYEE] as const;
export const DOCUMENT_ROLES = [SUPER_ADMIN, DEPARTMENT_MANAGER, ACCOUNTANT, EMPLOYEE] as const;
// Finance (design §2) : lecture SA, ACC et DM (scope) ; écriture SA et ACC ; validation SA
export const FINANCE_READ_ROLES = [SUPER_ADMIN, ACCOUNTANT, DEPARTMENT_MANAGER] as const;
export const FINANCE_WRITE_ROLES = [SUPER_ADMIN, ACCOUNTANT] as const;

// Rôle le plus élevé de l'utilisateur, utilisé pour le scoping des vues
export function primaryRole(user: AuthenticatedUser): string {
  for (const role of [SUPER_ADMIN, ACCOUNTANT, DEPARTMENT_MANAGER, EMPLOYEE]) {
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

/**
 * Scope de lecture finance (M13) : null pour SUPER_ADMIN et ACCOUNTANT (tout voir),
 * le département de l'utilisateur pour un DEPARTMENT_MANAGER. Tout autre rôle est refusé.
 */
export function financeScopeDepartmentId(user: AuthenticatedUser): string | null {
  if (user.roles.includes(SUPER_ADMIN) || user.roles.includes(ACCOUNTANT)) return null;
  if (user.roles.includes(DEPARTMENT_MANAGER) && user.employeeIdentity) {
    return user.employeeIdentity.departmentId;
  }
  throw new ForbiddenException();
}
