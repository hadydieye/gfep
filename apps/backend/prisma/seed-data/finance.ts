/**
 * 30 factures et 100 transactions fictives (gfep-mvp2/design.md §3.2), en GNF.
 * Données déterministes. Chaque ligne est rattachée à un département (M13),
 * réparti à tour de rôle sur les 6 départements.
 */
import { InvoiceStatus, TransactionStatus, TransactionType } from '@prisma/client';

export interface InvoiceSeed {
  invoiceNumber: string;
  clientName: string;
  amount: string;
  dueDate: string;
  status: InvoiceStatus;
  createdAt: string;
  /** Code du département de rattachement (M13) */
  department: string;
}

export interface TransactionSeed {
  reference: string;
  transactionType: TransactionType;
  amount: string;
  description: string;
  status: TransactionStatus;
  createdAt: string;
  /** Code du département de rattachement (M13) */
  department: string;
}

// Ordre de répartition des lignes sur les départements (M13)
export const FINANCE_DEPARTMENTS = ['DG', 'RH', 'CF', 'IT', 'CO', 'AC'] as const;

// Raisons sociales fictives
const CLIENTS = [
  'Kaloum Distribution SARL', 'Fouta Logistique', 'Baïlo Négoce', 'Kindia Fruits SARL', 'Labé Transports',
  'Atlantique Services', 'Conakry Bâtiment SA', 'Niger Agro Services', 'Boffa Pêche Industrielle', 'Dubréka Matériaux',
];

// DRAFT 4, SENT 8, PAID 12, OVERDUE 4, CANCELLED 2
const INVOICE_STATUSES: InvoiceStatus[] = [
  ...Array<InvoiceStatus>(4).fill(InvoiceStatus.DRAFT),
  ...Array<InvoiceStatus>(8).fill(InvoiceStatus.SENT),
  ...Array<InvoiceStatus>(12).fill(InvoiceStatus.PAID),
  ...Array<InvoiceStatus>(4).fill(InvoiceStatus.OVERDUE),
  ...Array<InvoiceStatus>(2).fill(InvoiceStatus.CANCELLED),
];

const day = (month: number, dayOfMonth: number) =>
  `2026-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;

export const INVOICES: InvoiceSeed[] = Array.from({ length: 30 }, (_, index) => {
  const month = (index % 10) + 1;
  return {
    invoiceNumber: `FAC-2026-${String(index + 1).padStart(4, '0')}`,
    clientName: CLIENTS[index % CLIENTS.length],
    // Montants en GNF, arrondis à 1 000
    amount: `${(2_500_000 + ((index * 7_919_000) % 95_000_000)).toFixed(2)}`,
    dueDate: day(Math.min(month + 1, 12), 28),
    status: INVOICE_STATUSES[(index * 7) % 30],
    createdAt: day(month, ((index * 3) % 27) + 1),
    department: FINANCE_DEPARTMENTS[index % FINANCE_DEPARTMENTS.length],
  };
});

const INCOME_LABELS = ['Encaissement client', 'Commission de gestion', 'Intérêts créditeurs', 'Frais de dossier'];
const EXPENSE_LABELS = ['Fournitures de bureau', 'Loyer agence', 'Maintenance informatique', 'Déplacement professionnel', 'Prestation de conseil'];

// PENDING 20, VALIDATED 70, REJECTED 10
const TRANSACTION_STATUSES: TransactionStatus[] = [
  ...Array<TransactionStatus>(20).fill(TransactionStatus.PENDING),
  ...Array<TransactionStatus>(70).fill(TransactionStatus.VALIDATED),
  ...Array<TransactionStatus>(10).fill(TransactionStatus.REJECTED),
];

export const TRANSACTIONS: TransactionSeed[] = Array.from({ length: 100 }, (_, index) => {
  const income = index % 3 === 0;
  const labels = income ? INCOME_LABELS : EXPENSE_LABELS;
  return {
    reference: `TRX-2026-${String(index + 1).padStart(5, '0')}`,
    transactionType: income ? TransactionType.INCOME : TransactionType.EXPENSE,
    amount: `${(150_000 + ((index * 1_237_000) % 48_000_000)).toFixed(2)}`,
    description: `${labels[index % labels.length]} — opération ${index + 1}`,
    status: TRANSACTION_STATUSES[(index * 13) % 100],
    createdAt: day((index % 10) + 1, ((index * 7) % 27) + 1),
    department: FINANCE_DEPARTMENTS[index % FINANCE_DEPARTMENTS.length],
  };
});
