import { redirect } from 'next/navigation';
import { ApiErrorState } from '@/components/states/states';
import { DocumentDetail } from '@/components/documents/document-detail';
import { DocumentHistory } from '@/components/documents/document-history';
import { apiGet } from '@/lib/api/server';
import type { DocumentItem } from '@/lib/api/types';
import { getSession, hasPermission } from '@/lib/auth/session';

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), apiGet<DocumentItem>(`/documents/${id}`)]);
  if (!user || (!result.ok && result.status === 401)) redirect('/login');
  if (!result.ok) {
    return <ApiErrorState status={result.status} message="Impossible de charger ce document." />;
  }
  return (
    <div className="flex flex-col gap-5">
      <DocumentDetail initialDocument={result.data} />
      {hasPermission(user, 'documents', 'history') && <DocumentHistory documentId={result.data.id} />}
    </div>
  );
}
