// Types des réponses de l'API backend (/api/v1)

export type EmploymentStatus = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
export type ConfidentialityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type DocumentValidationStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';

export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'PENDING' | 'VALIDATED' | 'REJECTED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type RoleName =
  | 'SUPER_ADMIN'
  | 'IT_ADMINISTRATOR'
  | 'IT_TECHNICIAN'
  | 'HR_MANAGER'
  | 'ACCOUNTANT'
  | 'DEPARTMENT_MANAGER'
  | 'EMPLOYEE'
  | 'AUDITOR';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
export type AuthProvider = 'LOCAL' | 'ACTIVE_DIRECTORY';

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
    /** Montants décimaux en chaîne (jamais en nombre) */
    monthIncome?: string;
    monthExpense?: string;
    month?: string;
    pendingInvoicesTotal?: number;
  };
  recentActivity: [];
  recentDocuments?: Array<{ id: string; title: string; createdAt: string }>;
  pendingDocuments?: Array<{ id: string; title: string; createdAt: string }>;
  recentTransactions?: Array<{
    id: string;
    reference: string;
    transactionType: TransactionType;
    amount: string;
    currency: string;
    status: TransactionStatus;
    createdAt: string;
  }>;
  pendingInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    amount: string;
    currency: string;
    dueDate: string;
    status: InvoiceStatus;
  }>;
  services?: { database: 'UP' | 'DOWN'; ldap: 'NOT_CONFIGURED' };
  recentAccounts?: { created: DashboardAccount[]; suspended: DashboardAccount[] };
  headcountByDepartment?: Array<{ code: string; name: string; count: number }>;
  recentHires?: Array<{ id: string; firstName: string; lastName: string; department: string; hireDate: string }>;
}

export interface DashboardAccount {
  id: string;
  username: string;
  displayName: string | null;
  status: UserStatus;
  date: string;
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

export interface DocumentItem {
  id: string;
  title: string;
  description: string | null;
  category: { id: string; name: string };
  department: { id: string; name: string };
  owner: { id: string; firstName: string; lastName: string };
  mimeType: string;
  fileSize: number;
  confidentialityLevel: ConfidentialityLevel;
  validationStatus: DocumentValidationStatus;
  createdAt: string;
  capabilities: {
    canDownload: boolean;
    canPreview: boolean;
    canValidate: boolean;
    canShare: boolean;
    canDelete: boolean;
  };
}

export interface PaginatedDocuments {
  data: DocumentItem[];
  total: number;
  page: number;
  limit: number;
}

export interface DocumentCategory {
  id: string;
  name: string;
  department: { id: string; name: string } | null;
  canUpload: boolean;
}

export interface DocumentSharePermission {
  id: string;
  userId: string;
  username: string;
  employee: { firstName: string; lastName: string } | null;
  permission: 'READ' | 'WRITE' | 'DELETE';
  grantedAt: string;
}

export interface DocumentShareRecipient {
  id: string;
  username: string;
  displayName: string;
}

export interface FinanceDepartment {
  id: string;
  name: string;
  code: string;
}

export interface Transaction {
  id: string;
  reference: string;
  transactionType: TransactionType;
  /** Montant décimal en chaîne, jamais en nombre */
  amount: string;
  currency: string;
  description: string | null;
  status: TransactionStatus;
  createdAt: string;
  department: FinanceDepartment | null;
  createdBy: { id: string; username: string } | null;
}

export interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  /** Montant décimal en chaîne, jamais en nombre */
  amount: string;
  currency: string;
  dueDate: string;
  status: InvoiceStatus;
  createdAt: string;
  department: FinanceDepartment | null;
  createdBy: { id: string; username: string } | null;
  allowedTransitions: InvoiceStatus[];
}

export interface PaginatedInvoices {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface RoleSummary {
  id: string;
  name: RoleName;
  description: string | null;
  userCount: number;
  permissionCount: number;
}

export interface PermissionItem {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RoleDetail extends RoleSummary {
  permissionIds: string[];
  catalog: PermissionItem[];
  editable: boolean;
  lockedPermissionIds: string[];
}

export interface Account {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  department: { id: string; name: string; code: string } | null;
  roles: Array<{ id: string; name: RoleName }>;
  status: UserStatus;
  authProvider: AuthProvider;
  lastLoginAt: string | null;
  createdAt: string;
  capabilities: { canAssignRoles: boolean; canChangeStatus: boolean; canUnlock: boolean };
}

export interface PaginatedAccounts {
  data: Account[];
  total: number;
  page: number;
  limit: number;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message?: string };
