import { Badge } from '@/components/ui/badge';
import type { InvoiceStatus, TransactionStatus, TransactionType } from '@/lib/api/types';

type Variant = 'success' | 'neutral' | 'warning' | 'error';

export const TRANSACTION_STATUS: Record<TransactionStatus, { label: string; variant: Variant }> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  VALIDATED: { label: 'Validée', variant: 'success' },
  REJECTED: { label: 'Rejetée', variant: 'error' },
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; variant: Variant }> = {
  DRAFT: { label: 'Brouillon', variant: 'neutral' },
  SENT: { label: 'En attente', variant: 'warning' },
  PAID: { label: 'Payée', variant: 'success' },
  OVERDUE: { label: 'En retard', variant: 'error' },
  CANCELLED: { label: 'Annulée', variant: 'neutral' },
};

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  INCOME: 'Recette',
  EXPENSE: 'Dépense',
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  const badge = TRANSACTION_STATUS[status];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const badge = INVOICE_STATUS[status];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
