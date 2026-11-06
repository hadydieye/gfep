import type { AuthProvider, UserStatus } from '@prisma/client';

export interface RoleSummaryDto {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
  permissionCount: number;
}

export interface PermissionDto {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RoleDetailDto extends RoleSummaryDto {
  permissionIds: string[];
  /** Catalogue complet des permissions, trié par ressource puis action */
  catalog: PermissionDto[];
  /** Vrai si l'utilisateur courant peut modifier ce rôle (SUPER_ADMIN, rôle non SUPER_ADMIN) */
  editable: boolean;
  /** Permissions que l'utilisateur courant ne peut pas retirer (rôle qu'il détient, M18) */
  lockedPermissionIds: string[];
}

export interface AccountDto {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  department: { id: string; name: string; code: string } | null;
  roles: Array<{ id: string; name: string }>;
  status: UserStatus;
  authProvider: AuthProvider;
  lastLoginAt: string | null;
  createdAt: string;
  /** Actions permises à l'utilisateur courant selon ses permissions et M17 (le serveur fait foi) */
  capabilities: {
    canAssignRoles: boolean;
    canChangeStatus: boolean;
    canUnlock: boolean;
  };
}

export interface PaginatedAccountsDto {
  data: AccountDto[];
  total: number;
  page: number;
  limit: number;
}
