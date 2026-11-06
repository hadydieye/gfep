import { redirect } from 'next/navigation';
import { InvoiceDetail } from '@/components/finance/invoice-detail';
import { ApiErrorState } from '@/components/states/states';
import { apiGet } from '@/lib/api/server';
import type { Invoice } from '@/lib/api/types';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<Invoice>(`/invoices/${id}`);
  if (!result.ok && result.status === 401) redirect('/login');
  if (!result.ok) {
    return <ApiErrorState status={result.status} message="Impossible de charger cette facture." />;
  }
  return <InvoiceDetail invoice={result.data} />;
}
