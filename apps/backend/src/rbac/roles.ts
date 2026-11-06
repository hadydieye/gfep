import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

export const SUPER_ADMIN = 'SUPER_ADMIN';
export const IT_ADMINISTRATOR = 'IT_ADMINISTRATOR';
export const IT_TECHNICIAN = 'IT_TECHNICIAN';
export const HR_MANAGER = 'HR_MANAGER';
export const ACCOUNTANT = 'ACCOUNTANT';
export const DEPARTMENT_MANAGER = 'DEPARTMENT_MANAGER';
export const EMPLOYEE = 'EMPLOYEE';
export const AUDITOR = 'AUDITOR';

// Listes de rôles par route, alignées sur la matrice d'accès (gfep-mvp2/design.md §2)
export const ALL_ROLES = [
  SUPER_ADMIN,
  IT_ADMINISTRATOR,
  IT_TECHNICIAN,
  HR_MANAGER,
  ACCOUNTANT,
  DEPARTMENT_MANAGER,
  EMPLOYEE,
  AUDITOR,
] as const;
// Lecture du dashboard, des employés et des départements : les 8 rôles
export const READ_ROLES = ALL_ROLES;
// Écriture et changement de statut des employés : SA et HR partout, DM dans son département
export const EMPLOYEE_WRITE_ROLES = [SUPER_ADMIN, HR_MANAGER, DEPARTMENT_MANAGER] as const;
// Documents : tous les rôles sauf IT_TECHNICIAN (M15)
export const DOCUMENT_ROLES = [
  SUPER_ADMIN,
  IT_ADMINISTRATOR,
  HR_MANAGER,
  ACCOUNTANT,
  DEPARTMENT_MANAGER,
  EMPLOYEE,
  AUDITOR,
] as const;
export const DOCUMENT_VALIDATE_ROLES = [SUPER_ADMIN, DEPARTMENT_MANAGER] as const;
// Finance : lecture SA, ACC et DM (scope) ; écriture SA et ACC ; validation SA
export const FINANCE_READ_ROLES = [SUPER_ADMIN, ACCOUNTANT, DEPARTMENT_MANAGER] as const;
export const FINANCE_WRITE_ROLES = [SUPER_ADMIN, ACCOUNTANT] as const;
// Accès : SA et ITA (rôles en lecture seule pour l'ITA, M18)
export const ACCESS_ROLES = [SUPER_ADMIN, IT_ADMINISTRATOR] as const;

// Libellés français des rôles (notifications), alignés sur l'interface
export const ROLE_LABELS: Record<string, string> = {
  [SUPER_ADMIN]: 'Super Admin',
  [IT_ADMINISTRATOR]: 'Administrateur IT',
  [IT_TECHNICIAN]: 'Technicien IT',
  [HR_MANAGER]: 'Responsable RH',
  [ACCOUNTANT]: 'Comptable',
  [DEPARTMENT_MANAGER]: 'Responsable de département',
  [EMPLOYEE]: 'Employé',
  [AUDITOR]: 'Auditeur',
};

export function roleLabel(name: string): string {
  return ROLE_LABELS[name] ?? name;
}

// Ordre de priorité du rôle principal (I6) : il détermine le dashboard affiché
const ROLE_PRIORITY = [
  SUPER_ADMIN,
  IT_ADMINISTRATOR,
  HR_MANAGER,
  ACCOUNTANT,
  DEPARTMENT_MANAGER,
  AUDITOR,
  IT_TECHNICIAN,
  EMPLOYEE,
];

export function primaryRole(user: AuthenticatedUser): string {
  return ROLE_PRIORITY.find((role) => user.roles.includes(role)) ?? EMPLOYEE;
}

/**
 * Department Manager Scope des écritures sur les employés : null si l'utilisateur
 * n'est pas restreint (SUPER_ADMIN, HR_MANAGER), sinon le département du DEPARTMENT_MANAGER.
 */
export function writeScopeDepartmentId(user: AuthenticatedUser): string | null {
  if (user.roles.includes(SUPER_ADMIN) || user.roles.includes(HR_MANAGER)) return null;
  if (!user.roles.includes(DEPARTMENT_MANAGER) || !user.employeeIdentity) throw new ForbiddenException();
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
