import Link from 'next/link';
import { FileText } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import type { ApiResult, PaginatedDocuments } from '@/lib/api/types';
import { ConfidentialityBadge } from './document-badges';

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

/**
 * Liste courte de documents (fiche employé « Documents liés », détail de
 * département « Ressources documentaires », N11). Les documents viennent de
 * `GET /documents` : la visibilité M9 de l'utilisateur connecté s'applique.
 */
export function RelatedDocuments({
  title,
  result,
  moreHref,
  emptyMessage,
}: {
  title: string;
  result: ApiResult<PaginatedDocuments>;
  moreHref: string;
  emptyMessage: string;
}) {
  return (
    <section className="rounded-[8px] border border-border bg-background-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground-primary">{title}</h2>
        <FileText className="h-4 w-4 text-foreground-secondary" aria-hidden />
      </div>
      {!result.ok ? (
        <ApiErrorState status={result.status} message="Impossible de charger les documents." />
      ) : result.data.data.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border">
            {result.data.data.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/documents/${document.id}`} className="min-w-0 truncate font-medium text-link hover:underline">
                  {document.title}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <ConfidentialityBadge level={document.confidentialityLevel} />
                  <time className="text-xs text-foreground-secondary" dateTime={document.createdAt}>
                    {DATE.format(new Date(document.createdAt))}
                  </time>
                </span>
              </li>
            ))}
          </ul>
          {result.data.total > result.data.data.length && (
            <Link href={moreHref} className="mt-3 inline-block text-sm font-medium text-link hover:underline">
              Voir les {result.data.total} documents
            </Link>
          )}
        </>
      )}
    </section>
  );
}
