import type { AuditLogDto, SecurityEventDto } from '../../audit/dto/audit-response.dto.js';

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
  /** LDAP : Disponible (UP), Indisponible (DOWN) ou Non configuré, bind du compte de service mis en cache 30 s */
  services?: { database: 'UP' | 'DOWN'; ldap: 'UP' | 'DOWN' | 'NOT_CONFIGURED' };
  /** SA, ITA : comptes récemment créés et récemment suspendus */
  recentAccounts?: {
    created: DashboardAccountDto[];
    suspended: DashboardAccountDto[];
  };
  /** HR et SA : répartition des employés actifs par département et dernières embauches (N10) */
  headcountByDepartment?: Array<{ code: string; name: string; count: number }>;
  /** EMPLOYEE : 5 dernières notifications de l'utilisateur */
  recentNotifications?: Array<{ id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string }>;
  recentHires?: Array<{ id: string; firstName: string; lastName: string; department: string; hireDate: string }>;
  /** SA et AUD : 5 derniers audits (étape 2.6) ; vide pour les autres rôles */
  recentActivity: AuditLogDto[];
  /** AUD et SA : alertes de sécurité HIGH et CRITICAL ; ITA et SA : événements de sécurité récents (N10) */
  securityAlerts?: SecurityEventDto[];
  recentSecurityEvents?: SecurityEventDto[];
  recentDocuments?: Array<{ id: string; title: string; createdAt: string }>;
  /** DM : documents en attente de son département ; SA : 5 plus récents de tous les départements (N10) */
  pendingDocuments?: Array<{ id: string; title: string; createdAt: string }>;
  /** SA : nombre total de documents en attente de validation (N10) */
  pendingDocumentsTotal?: number;
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
