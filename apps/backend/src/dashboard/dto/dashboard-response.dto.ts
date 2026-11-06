export interface DashboardAccountDto {
  id: string;
  username: string;
  displayName: string | null;
  status: string;
  date: string;
}

export class DashboardResponseDto {
  role: string;
  indicators: {
    totalEmployees?: number;
    departmentEmployees?: number;
    departmentName?: string;
    /** ACCOUNTANT : recettes et dépenses validées du mois courant (chaînes décimales) */
    monthIncome?: string;
    monthExpense?: string;
    /** Mois des indicateurs financiers, AAAA-MM */
    month?: string;
    /** ACCOUNTANT : nombre total de factures en attente (SENT et OVERDUE) */
    pendingInvoicesTotal?: number;
  };
  /** SA, ITA, ITT : état des services (base de données ; LDAP « non configuré » avant 2.7) */
  services?: { database: 'UP' | 'DOWN'; ldap: 'NOT_CONFIGURED' };
  /** SA, ITA : comptes récemment créés et récemment suspendus */
  recentAccounts?: {
    created: DashboardAccountDto[];
    suspended: DashboardAccountDto[];
  };
  /** HR : répartition des employés actifs par département et dernières embauches */
  headcountByDepartment?: Array<{ code: string; name: string; count: number }>;
  /** EMPLOYEE : 5 dernières notifications de l'utilisateur */
  recentNotifications?: Array<{ id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string }>;
  recentHires?: Array<{ id: string; firstName: string; lastName: string; department: string; hireDate: string }>;
  recentActivity: []; // vide en MVP 1, réservé pour MVP 2
  recentDocuments?: Array<{ id: string; title: string; createdAt: string }>;
  pendingDocuments?: Array<{ id: string; title: string; createdAt: string }>;
  recentTransactions?: Array<{
    id: string;
    reference: string;
    transactionType: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  pendingInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    amount: string;
    currency: string;
    dueDate: string;
    status: string;
  }>;
}
