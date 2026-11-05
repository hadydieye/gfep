// Types des réponses de l'API backend (/api/v1)

export type EmploymentStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';

export type RoleName = 'SUPER_ADMIN' | 'DEPARTMENT_MANAGER' | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  status: string;
  roles: Array<{ id: string; name: string }>;
  permissions: Array<{ resource: string; action: string }>;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    departmentId: string;
  } | null;
}

export interface DashboardData {
  role: RoleName;
  indicators: {
    totalEmployees?: number;
    departmentEmployees?: number;
    departmentName?: string;
  };
  recentActivity: [];
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  professionalEmail: string;
  phone: string | null;
  departmentId: string;
  department: { id: string; name: string; code: string };
  positionId: string;
  position: { id: string; title: string };
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedEmployees {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  headcount: number;
  manager: { id: string; firstName: string; lastName: string; position: string } | null;
  positions: Array<{ id: string; title: string }>;
  createdAt: string;
}

export interface DepartmentDetail extends Department {
  employees: Array<{
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    position: string;
    employmentStatus: EmploymentStatus;
  }>;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message?: string };
