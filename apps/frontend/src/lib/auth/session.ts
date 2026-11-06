import { cache } from 'react';
import { apiGet } from '@/lib/api/server';
import type { AuthUser, RoleName } from '@/lib/api/types';

/**
 * Profil de l'utilisateur connecté, ou null si le cookie de session est absent,
 * invalide ou expiré. Server Components uniquement ; mémoïsé par requête.
 */
export const getSession = cache(async (): Promise<AuthUser | null> => {
  const result = await apiGet<AuthUser>('/auth/me');
  return result.ok ? result.data : null;
});

export function hasRole(user: AuthUser, ...roles: RoleName[]): boolean {
  return user.roles.some((role) => roles.includes(role.name as RoleName));
}

export function hasPermission(user: AuthUser, resource: string, action: string): boolean {
  return user.permissions.some((p) => p.resource === resource && p.action === action);
}

// Ordre de priorité aligné sur le backend (rbac/roles.ts) : détermine le dashboard
const ROLE_PRIORITY: RoleName[] = [
  'SUPER_ADMIN',
  'IT_ADMINISTRATOR',
  'HR_MANAGER',
  'ACCOUNTANT',
  'DEPARTMENT_MANAGER',
  'AUDITOR',
  'IT_TECHNICIAN',
  'EMPLOYEE',
];

export function primaryRole(user: AuthUser): RoleName {
  return ROLE_PRIORITY.find((role) => hasRole(user, role)) ?? 'EMPLOYEE';
}
