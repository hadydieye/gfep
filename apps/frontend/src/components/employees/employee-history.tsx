import { History } from 'lucide-react';
import { auditActionLabel, formatAuditDate } from '@/components/audit/audit-labels';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import type { ApiResult, AuditLogItem, Paginated } from '@/lib/api/types';

/**
 * « Historique » de la fiche employé (AppFlow §3.4, N11) : entrées d'audit
 * `employee.*` de cette fiche, affichées aux seuls titulaires de `audit:read`.
 */
export function EmployeeHistory({ result }: { result: ApiResult<Paginated<AuditLogItem>> }) {
  return (
    <section className="rounded-[8px] border border-border bg-background-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground-primary">Historique</h2>
        <History className="h-4 w-4 text-foreground-secondary" aria-hidden />
      </div>
      {!result.ok ? (
        <ApiErrorState status={result.status} message="Impossible de charger l’historique." />
      ) : result.data.data.length === 0 ? (
        <EmptyState message="Aucune modification journalisée pour cette fiche." />
      ) : (
        <ol className="flex flex-col gap-3">
          {result.data.data.map((entry) => (
            <li key={entry.id} className="flex flex-col text-sm">
              <span className="font-medium text-foreground-primary">{auditActionLabel(entry.action)}</span>
              <span className="text-xs text-foreground-secondary">
                {entry.actor.username} · {formatAuditDate(entry.timestamp)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
