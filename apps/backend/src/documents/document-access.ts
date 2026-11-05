import { ConfidentialityLevel, DocumentPermissionType, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

export interface DocumentAccessRecord {
  ownerId: string;
  category: { departmentId: string | null };
  owner: { departmentId: string };
  permissions: Array<{ userId: string; permission: DocumentPermissionType }>;
}

export function documentDepartmentId(document: Pick<DocumentAccessRecord, 'category' | 'owner'>) {
  return document.category.departmentId ?? document.owner.departmentId;
}

export function buildVisibilityWhere(user: AuthenticatedUser): Prisma.DocumentWhereInput {
  if (user.roles.includes('SUPER_ADMIN')) return {};

  const visible: Prisma.DocumentWhereInput[] = [
    { confidentialityLevel: ConfidentialityLevel.PUBLIC },
    { permissions: { some: { userId: user.id } } },
  ];
  if (user.employeeIdentity) {
    visible.push({ ownerId: user.employeeIdentity.employeeId });
  }
  if (user.employeeIdentity?.departmentId) {
    visible.push({
      confidentialityLevel: ConfidentialityLevel.INTERNAL,
      OR: [
        { category: { is: { departmentId: user.employeeIdentity.departmentId } } },
        {
          category: { is: { departmentId: null } },
          owner: { is: { departmentId: user.employeeIdentity.departmentId } },
        },
      ],
    });
  }
  return { OR: visible };
}

export function canValidate(document: DocumentAccessRecord, user: AuthenticatedUser): boolean {
  if (user.employeeIdentity?.employeeId === document.ownerId) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return (
    user.roles.includes('DEPARTMENT_MANAGER') &&
    user.employeeIdentity?.departmentId === documentDepartmentId(document)
  );
}

export function canShare(document: DocumentAccessRecord, user: AuthenticatedUser): boolean {
  return (
    user.roles.includes('SUPER_ADMIN') || user.employeeIdentity?.employeeId === document.ownerId
  );
}

export function canDelete(document: DocumentAccessRecord, user: AuthenticatedUser): boolean {
  return (
    user.roles.includes('SUPER_ADMIN') ||
    user.employeeIdentity?.employeeId === document.ownerId ||
    document.permissions.some(
      ({ userId, permission }) =>
        userId === user.id && permission === DocumentPermissionType.DELETE,
    )
  );
}