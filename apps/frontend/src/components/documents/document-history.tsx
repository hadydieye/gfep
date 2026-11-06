'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { auditActionLabel, formatAuditDate } from '@/components/audit/audit-labels';
import { ApiErrorState } from '@/components/states/states';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { DocumentHistoryEntry } from '@/lib/api/types';

type HistoryState =
  | { kind: 'loading' }
  | { kind: 'error'; status: number }
  | { kind: 'ready'; entries: DocumentHistoryEntry[] };

/** Historique de consultation (R28.4) : SUPER_ADMIN et AUDITOR (`documents:history`, M24). */
export function DocumentHistory({ documentId }: { documentId: string }) {
  const [state, setState] = useState<HistoryState>({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void apiFetch<DocumentHistoryEntry[]>(`/documents/${documentId}/history`).then((result) => {
      if (!active) return;
      setState(result.ok ? { kind: 'ready', entries: result.data } : { kind: 'error', status: result.status });
    });
    return () => {
      active = false;
    };
  }, [documentId, reload]);

  return (
    <section aria-labelledby="document-history-title" className="rounded-[8px] border border-border bg-background-surface p-5">
      <h2 id="document-history-title" className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground-primary">
        <History className="h-4 w-4 text-foreground-secondary" aria-hidden />
        Historique de consultation
      </h2>
      {state.kind === 'loading' ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-4 w-full" />)}
        </div>
      ) : state.kind === 'error' ? (
        <ApiErrorState status={state.status} message="Impossible de charger l’historique." onRetry={() => setReload((v) => v + 1)} />
      ) : state.entries.length === 0 ? (
        <p className="text-sm text-foreground-secondary">Aucune consultation journalisée pour ce document.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border text-sm">
          {state.entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span className="text-foreground-primary">
                {auditActionLabel(entry.action)} <span className="text-foreground-secondary">par {entry.actor.username}</span>
              </span>
              <span className="text-xs tabular-nums text-foreground-secondary">
                {formatAuditDate(entry.timestamp)} · {entry.sourceIp}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
