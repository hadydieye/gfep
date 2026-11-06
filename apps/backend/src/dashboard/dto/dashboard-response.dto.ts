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
