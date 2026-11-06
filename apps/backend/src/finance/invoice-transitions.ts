import { InvoiceStatus } from '@prisma/client';

/**
 * Transitions de statut autorisées pour une facture (gfep-mvp2/DECISIONS.md M14).
 * PAID et CANCELLED sont finaux. Toute autre transition, y compris vers le même
 * statut, est interdite (400).
 */
export const INVOICE_TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELLED],
  [InvoiceStatus.OVERDUE]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: [],
};

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

export const FORBIDDEN_INVOICE_TRANSITION_MESSAGE =
  "Ce changement de statut n'est pas autorisé pour cette facture.";
