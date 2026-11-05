import { redirect } from 'next/navigation';
import { ApiErrorState } from '@/components/states/states';
import { DocumentDetail } from '@/components/documents/document-detail';
import { apiGet } from '@/lib/api/server';
import type { DocumentItem } from '@/lib/api/types';

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<DocumentItem>(`/documents/${id}`);
  if (!result.ok && result.status === 401) redirect('/login');
  if (!result.ok) {
    return <ApiErrorState status={result.status} message="Impossible de charger ce document." />;
  }
  return <DocumentDetail initialDocument={result.data} />;
}