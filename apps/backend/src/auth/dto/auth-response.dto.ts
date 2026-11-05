export class RoleDto {
  id: string;
  name: string;
}

export class PermissionDto {
  resource: string;
  action: string;
}

export class AuthResponseDto {
  id: string;
  username: string;
  email: string;
  status: string;
  roles: RoleDto[];
  permissions: PermissionDto[];
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    departmentId: string;
  } | null;
}
