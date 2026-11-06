import type { InvoiceStatus, TransactionStatus, TransactionType } from '@prisma/client';

export interface FinanceDepartmentDto {
  id: string;
  name: string;
  code: string;
}

export interface FinanceUserDto {
  id: string;
  username: string;
}

export class TransactionResponseDto {
  id: string;
  reference: string;
  transactionType: TransactionType;
  /** Montant décimal sérialisé en chaîne (2 décimales), jamais en nombre */
  amount: string;
  currency: string;
  description: string | null;
  status: TransactionStatus;
  createdAt: string;
  department: FinanceDepartmentDto | null;
  createdBy: FinanceUserDto | null;
}

export class PaginatedTransactionsDto {
  data: TransactionResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export class InvoiceResponseDto {
  id: string;
  invoiceNumber: string;
  clientName: string;
  /** Montant décimal sérialisé en chaîne (2 décimales), jamais en nombre */
  amount: string;
  currency: string;
  dueDate: string;
  status: InvoiceStatus;
  createdAt: string;
  department: FinanceDepartmentDto | null;
  createdBy: FinanceUserDto | null;
  /** Statuts atteignables par l'utilisateur courant (vide sans `invoices:status`) */
  allowedTransitions: InvoiceStatus[];
}

export class PaginatedInvoicesDto {
  data: InvoiceResponseDto[];
  total: number;
  page: number;
  limit: number;
}
