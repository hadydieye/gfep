import { Prisma, UserStatus } from '@prisma/client';

// Relations chargées pour construire le contexte d'authentification
export const USER_AUTH_INCLUDE = {
  userRoles: {
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
    },
  },
  employeeIdentity: { include: { employee: true } },
} satisfies Prisma.UserInclude;

export type UserWithAuthRelations = Prisma.UserGetPayload<{ include: typeof USER_AUTH_INCLUDE }>;

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  username: string;
  email: string;
  status: UserStatus;
  roles: string[];
  permissions: Array<{ resource: string; action: string }>;
  employeeIdentity: { employeeId: string; departmentId: string } | null;
}

// Typage de req.user posé par SessionMiddleware
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser | null;
    }
  }
}

export function collectPermissions(user: UserWithAuthRelations) {
  const seen = new Map<string, { resource: string; action: string }>();
  for (const userRole of user.userRoles) {
    for (const { permission } of userRole.role.rolePermissions) {
      seen.set(`${permission.resource}:${permission.action}`, {
        resource: permission.resource,
        action: permission.action,
      });
    }
  }
  return [...seen.values()];
}

export function toAuthenticatedUser(
  user: UserWithAuthRelations,
  sessionId: string,
): AuthenticatedUser {
  const employee = user.employeeIdentity?.employee;
  return {
    id: user.id,
    sessionId,
    username: user.username,
    email: user.email,
    status: user.status,
    roles: user.userRoles.map((userRole) => userRole.role.name),
    permissions: collectPermissions(user),
    employeeIdentity: employee
      ? { employeeId: employee.id, departmentId: employee.departmentId }
      : null,
  };
}
