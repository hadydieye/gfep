import { ConfidentialityLevel, DocumentPermissionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import {
  buildVisibilityWhere,
  canDelete,
  canShare,
  canValidate,
  documentDepartmentId,
} from './document-access.js';

const user = (
  id: string,
  role: string,
  employeeId: string | null,
  departmentId: string | null,
): AuthenticatedUser => ({
  id,
  sessionId: 'session',
  username: id,
  email: `${id}@guineasf.com`,
  status: 'ACTIVE',
  roles: [role],
  permissions: [{ resource: 'documents', action: 'read' }],
  employeeIdentity: employeeId ? { employeeId, departmentId: departmentId! } : null,
});

const document = {
  ownerId: 'owner-employee',
  category: { departmentId: 'department-category' },
  owner: { departmentId: 'department-owner' },
  permissions: [{ userId: 'shared-user', permission: DocumentPermissionType.READ }],
};

describe('document access rules', () => {
  it('uses the category department, falling back to owner department only when absent', () => {
    expect(documentDepartmentId(document)).toBe('department-category');
    expect(documentDepartmentId({ ...document, category: { departmentId: null } })).toBe(
      'department-owner',
    );
  });

  it('applies public, ownership, internal department and explicit-permission visibility', () => {
    const where = buildVisibilityWhere(user('reader', 'EMPLOYEE', 'reader-employee', 'dept-a'));
    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        { confidentialityLevel: ConfidentialityLevel.PUBLIC },
        { ownerId: 'reader-employee' },
        { permissions: { some: { userId: 'reader' } } },
        {
          confidentialityLevel: ConfidentialityLevel.INTERNAL,
          OR: [
            { category: { is: { departmentId: 'dept-a' } } },
            { category: { is: { departmentId: null } }, owner: { is: { departmentId: 'dept-a' } } },
          ],
        },
      ]),
    });
  });

  it('gives the SUPER_ADMIN unrestricted visibility', () => {
    expect(buildVisibilityWhere(user('admin', 'SUPER_ADMIN', 'admin-employee', 'dept-a'))).toEqual({});
  });

  it('allows only a manager in the document department or the SUPER_ADMIN to validate, never its owner', () => {
    expect(canValidate(document, user('manager', 'DEPARTMENT_MANAGER', 'manager-id', 'department-category'))).toBe(true);
    expect(canValidate(document, user('other-manager', 'DEPARTMENT_MANAGER', 'other-id', 'department-owner'))).toBe(false);
    expect(canValidate(document, user('admin', 'SUPER_ADMIN', 'admin-id', 'dept-a'))).toBe(true);
    expect(canValidate(document, user('owner', 'SUPER_ADMIN', 'owner-employee', 'dept-a'))).toBe(false);
  });

  it('limits sharing and deletion to the specified ownership and DELETE permission rules', () => {
    expect(canShare(document, user('owner', 'EMPLOYEE', 'owner-employee', 'dept-a'))).toBe(true);
    expect(canShare(document, user('shared-user', 'EMPLOYEE', 'shared-employee', 'dept-a'))).toBe(false);
    expect(canDelete(document, user('shared-user', 'EMPLOYEE', 'shared-employee', 'dept-a'))).toBe(false);
    expect(
      canDelete(
        { ...document, permissions: [{ userId: 'shared-user', permission: DocumentPermissionType.DELETE }] },
        user('shared-user', 'EMPLOYEE', 'shared-employee', 'dept-a'),
      ),
    ).toBe(true);
  });
});