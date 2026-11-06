import type { Prisma } from '@prisma/client';
import type { SortMap } from '../common/sorting.js';

type TransactionOrderBy = Prisma.TransactionOrderByWithRelationInput;
type InvoiceOrderBy = Prisma.InvoiceOrderByWithRelationInput;

/** Colonnes triables de `GET /transactions` et de son export (N5, N6). */
export const TRANSACTION_SORTS: SortMap<TransactionOrderBy> = {
  reference: (order) => [{ reference: order }],
  type: (order) => [{ transactionType: order }],
  amount: (order) => [{ amount: order }],
  status: (order) => [{ status: order }],
  department: (order) => [{ department: { name: order } }],
  createdAt: (order) => [{ createdAt: order }],
};
export const TRANSACTION_SORT_TIEBREAKER: TransactionOrderBy[] = [{ reference: 'asc' }];
export const TRANSACTION_DEFAULT_ORDER: TransactionOrderBy[] = [{ createdAt: 'desc' }, { reference: 'desc' }];

/** Colonnes triables de `GET /invoices` et de son export (N5, N6). */
export const INVOICE_SORTS: SortMap<InvoiceOrderBy> = {
  invoiceNumber: (order) => [{ invoiceNumber: order }],
  clientName: (order) => [{ clientName: order }],
  amount: (order) => [{ amount: order }],
  dueDate: (order) => [{ dueDate: order }],
  status: (order) => [{ status: order }],
  department: (order) => [{ department: { name: order } }],
};
export const INVOICE_SORT_TIEBREAKER: InvoiceOrderBy[] = [{ invoiceNumber: 'asc' }];
export const INVOICE_DEFAULT_ORDER: InvoiceOrderBy[] = [{ dueDate: 'desc' }, { invoiceNumber: 'desc' }];
