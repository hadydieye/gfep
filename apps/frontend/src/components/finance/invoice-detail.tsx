'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { RefreshCw } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { apiFetch } from '@/lib/api/client';
import type { Invoice, InvoiceStatus } from '@/lib/api/types';
import { INVOICE_STATUS, InvoiceStatusBadge } from './finance-badges';
import { MoneyAmount } from './money-amount';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

// Annulation et paiement sont définitifs (M14) : confirmation en variante destructive pour l'annulation
const FINAL_STATUSES: InvoiceStatus[] = ['PAID', 'CANCELLED'];

export function InvoiceDetail({ invoice: initialInvoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [target, setTarget] = useState<InvoiceStatus | ''>('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const changeStatus = async () => {
    if (!target) return;
    setSaving(true);
    const result = await apiFetch<Invoice>(`/invoices/${invoice.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: target }),
    });
    setSaving(false);
    setConfirming(false);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else toast.error(result.message ?? 'Le statut n’a pas pu être modifié.');
      return;
    }
    setInvoice(result.data);
    setTarget('');
    toast.success(`Facture ${result.data.invoiceNumber} : statut « ${INVOICE_STATUS[result.data.status].label} ».`);
    router.refresh();
  };

  const rows: Array<[string, ReactNode]> = [
    ['Client', invoice.clientName],
    ['Montant', <MoneyAmount key="amount" amount={invoice.amount} currency={invoice.currency} className="font-medium" />],
    ['Échéance', DATE_FORMAT.format(new Date(invoice.dueDate))],
    ['Département', invoice.department?.name ?? '—'],
    ['Émise le', DATE_FORMAT.format(new Date(invoice.createdAt))],
    ['Créée par', invoice.createdBy?.username ?? '—'],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb items={[{ label: 'Finance' }, { label: 'Factures', href: '/finance/invoices' }, { label: invoice.invoiceNumber }]} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tabular-nums text-foreground-primary">{invoice.invoiceNumber}</h1>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-[8px] border border-border bg-background-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground-primary">Informations</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[160px_1fr]">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-foreground-secondary">{label}</dt>
                <dd className="text-foreground-primary">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {invoice.allowedTransitions.length > 0 && (
          <section className="flex flex-col gap-4 rounded-[8px] border border-border bg-background-surface p-6">
            <h2 className="text-lg font-semibold text-foreground-primary">Changer le statut</h2>
            <Select
              label="Nouveau statut"
              value={target}
              onChange={(event) => setTarget(event.target.value as InvoiceStatus | '')}
            >
              <option value="">Sélectionnez un statut</option>
              {invoice.allowedTransitions.map((status) => (
                <option key={status} value={status}>{INVOICE_STATUS[status].label}</option>
              ))}
            </Select>
            <div className="flex justify-end">
              <Button disabled={!target || saving} onClick={() => setConfirming(true)}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                Changer le statut
              </Button>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={confirming && target !== ''}
        title="Changer le statut de la facture"
        description={
          target
            ? `Passer la facture ${invoice.invoiceNumber} de « ${INVOICE_STATUS[invoice.status].label} » à « ${INVOICE_STATUS[target].label} » ?${FINAL_STATUSES.includes(target) ? ' Ce statut est définitif.' : ''}`
            : ''
        }
        confirmLabel="Confirmer"
        destructive={target === 'CANCELLED'}
        busy={saving}
        onOpenChange={setConfirming}
        onConfirm={changeStatus}
      />
    </div>
  );
}
