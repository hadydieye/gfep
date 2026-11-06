'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SortableHead } from '@/components/ui/sortable-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api/client';
import { useSort } from '@/lib/use-sort';
import type {
  AuditLogItem,
  AuthEventItem,
  AuthEventType,
  Paginated,
  SecurityEventItem,
  SecuritySeverity,
} from '@/lib/api/types';
import {
  AUDIT_ACTION_LABELS,
  AUTH_EVENT_LABELS,
  SECURITY_EVENT_LABELS,
  SEVERITY_LABELS,
  SeverityBadge,
  auditActionLabel,
  formatAuditDate,
  securityEventLabel,
} from './audit-labels';

const PAGE_SIZE = 25;
const TABS = [
  { value: 'logs', label: 'Journal d’activité' },
  { value: 'security', label: 'Événements de sécurité' },
  { value: 'auth', label: 'Authentifications' },
];

type ListState<T> =
  { kind: 'loading' } | { kind: 'error'; status: number } | { kind: 'ready'; result: Paginated<T> };

/** Chargement paginé d'une liste d'audit ; les filtres vides sont omis. */
function useAuditList<T>(
  path: string,
  filters: Record<string, string>,
  page: number,
  enabled = true,
) {
  const router = useRouter();
  const [state, setState] = useState<ListState<T>>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const key = JSON.stringify(filters);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setState({ kind: 'loading' });
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      for (const [name, value] of Object.entries(JSON.parse(key) as Record<string, string>)) {
        if (value.trim()) params.set(name, value.trim());
      }
      const result = await apiFetch<Paginated<T>>(`${path}?${params}`);
      if (!active) return;
      if (!result.ok && result.status === 401) {
        router.push('/login');
        return;
      }
      setState(
        result.ok
          ? { kind: 'ready', result: result.data }
          : { kind: 'error', status: result.status },
      );
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [path, key, page, reload, router, enabled]);

  return { state, retry: () => setReload((value) => value + 1) };
}

/** Tri d'un onglet d'audit (N6) : paramètres ajoutés aux filtres de la requête. */
function useAuditSort(keys: readonly string[], setPage: (page: number) => void) {
  const resetPage = useCallback(() => setPage(1), [setPage]);
  const sorting = useSort(keys, resetPage);
  const params: Record<string, string> = sorting.sort
    ? { sort: sorting.sort, order: sorting.order }
    : {};
  return { sorting, params };
}

const LOG_SORT_KEYS = ['timestamp', 'action', 'actor'] as const;
const SECURITY_SORT_KEYS = ['timestamp', 'eventType', 'severity'] as const;
const AUTH_SORT_KEYS = ['timestamp', 'eventType', 'user'] as const;

/**
 * Console d'audit (AppFlow §3.10, design §8.4) : lecture seule, réservée au
 * SUPER_ADMIN et à l'AUDITOR. Le serveur fait foi (403 pour les autres rôles).
 */
export function AuditConsole({ canReadSecurityEvents }: { canReadSecurityEvents: boolean }) {
  const [tab, setTab] = useState('logs');
  const items = canReadSecurityEvents ? TABS : TABS.filter((t) => t.value !== 'security');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground-primary">Audit</h1>
      <Tabs items={items} value={tab} onValueChange={setTab} label="Journaux">
        {tab === 'logs' && <LogsTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'auth' && <AuthTab />}
      </Tabs>
    </div>
  );
}

function Period({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <>
      <Input
        label="Du"
        type="date"
        value={from}
        max={to || undefined}
        onChange={(event) => setFrom(event.target.value)}
      />
      <Input
        label="Au"
        type="date"
        value={to}
        min={from || undefined}
        onChange={(event) => setTo(event.target.value)}
      />
    </>
  );
}

function Pager({
  page,
  total,
  setPage,
  unit,
}: {
  page: number;
  total: number;
  setPage: (p: number) => void;
  unit: string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground-secondary">
      <span>
        {total} {unit}
        {total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="icon"
          aria-label="Page précédente"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <span aria-live="polite">
          Page {page} sur {pages}
        </span>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Page suivante"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <TableRow key={index}>
          <TableCell colSpan={columns}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function LogsTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const { sorting, params: sortParams } = useAuditSort(LOG_SORT_KEYS, setPage);
  const { state, retry } = useAuditList<AuditLogItem>(
    '/audit/logs',
    { from, to, actor, action, ...sortParams },
    page,
    sorting.ready,
  );
  const filter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Period from={from} to={to} setFrom={filter(setFrom)} setTo={filter(setTo)} />
        <Input
          label="Utilisateur"
          value={actor}
          onChange={(event) => filter(setActor)(event.target.value)}
        />
        <Select
          label="Action"
          value={action}
          onChange={(event) => filter(setAction)(event.target.value)}
        >
          <option value="">Toutes les actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {state.kind === 'error' ? (
        <ApiErrorState
          status={state.status}
          message="Impossible de charger le journal d’activité."
          onRetry={retry}
        />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucune entrée ne correspond à ces critères." />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Date"
                    sortKey="timestamp"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Utilisateur"
                    sortKey="actor"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Action"
                    sortKey="action"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <TableHead>Ressource</TableHead>
                  <TableHead>Adresse IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.kind === 'loading' ? (
                  <LoadingRows columns={5} />
                ) : (
                  state.result.data.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      aria-selected={selected?.id === log.id}
                      onClick={() => setSelected(log)}
                      onKeyDown={(event) => event.key === 'Enter' && setSelected(log)}
                    >
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatAuditDate(log.timestamp)}
                      </TableCell>
                      <TableCell>{log.actor.username}</TableCell>
                      <TableCell>{auditActionLabel(log.action)}</TableCell>
                      <TableCell>{log.resourceType}</TableCell>
                      <TableCell className="tabular-nums">{log.sourceIp}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {state.kind === 'loading'
              ? Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))
              : state.result.data.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelected(log)}
                    className="flex flex-col gap-1 rounded-[8px] border border-border bg-background-surface p-4 text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link"
                  >
                    <span className="font-medium text-foreground-primary">
                      {auditActionLabel(log.action)}
                    </span>
                    <span className="text-foreground-secondary">
                      {log.actor.username} · {log.resourceType}
                    </span>
                    <span className="text-xs tabular-nums text-foreground-secondary">
                      {formatAuditDate(log.timestamp)} · {log.sourceIp}
                    </span>
                  </button>
                ))}
          </div>
        </>
      )}
      {selected && <AuditDetail log={selected} onClose={() => setSelected(null)} />}
      {state.kind === 'ready' && state.result.total > 0 && (
        <Pager page={page} total={state.result.total} setPage={setPage} unit="entrée" />
      )}
    </div>
  );
}

/** Panneau de détail : anciennes et nouvelles valeurs (liste blanche serveur, sans secret). */
function AuditDetail({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  return (
    <section
      aria-label="Détail de l’entrée"
      className="flex flex-col gap-3 rounded-[8px] border border-border bg-background-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground-primary">
            {auditActionLabel(log.action)}
          </h2>
          <p className="text-sm text-foreground-secondary">
            {log.actor.username} · {formatAuditDate(log.timestamp)} · {log.sourceIp}
          </p>
          <p className="text-xs text-foreground-secondary">
            {log.resourceType} {log.resourceId}
          </p>
        </div>
        <Button variant="secondary" size="icon" aria-label="Fermer le détail" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ValuesBlock title="Avant" values={log.oldValues} />
        <ValuesBlock title="Après" values={log.newValues} />
      </div>
    </section>
  );
}

function ValuesBlock({ title, values }: { title: string; values: unknown }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-secondary">
        {title}
      </h3>
      {values && typeof values === 'object' && Object.keys(values).length > 0 ? (
        <dl className="grid grid-cols-[minmax(0,160px)_1fr] gap-x-3 gap-y-1 rounded-md bg-background-main p-3 text-sm">
          {Object.entries(values as Record<string, unknown>).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="truncate text-foreground-secondary">{key}</dt>
              <dd className="break-words text-foreground-primary">
                {Array.isArray(value) ? value.join(', ') : String(value ?? '—')}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-foreground-secondary">Aucune valeur.</p>
      )}
    </div>
  );
}

function SecurityTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [severity, setSeverity] = useState<SecuritySeverity | ''>('');
  const [eventType, setEventType] = useState('');
  const [page, setPage] = useState(1);
  const { sorting, params: sortParams } = useAuditSort(SECURITY_SORT_KEYS, setPage);
  const { state, retry } = useAuditList<SecurityEventItem>(
    '/audit/security-events',
    { from, to, severity, eventType, ...sortParams },
    page,
    sorting.ready,
  );
  const filter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Period from={from} to={to} setFrom={filter(setFrom)} setTo={filter(setTo)} />
        <Select
          label="Sévérité"
          value={severity}
          onChange={(event) => {
            setSeverity(event.target.value as SecuritySeverity | '');
            setPage(1);
          }}
        >
          <option value="">Toutes les sévérités</option>
          {(Object.keys(SEVERITY_LABELS) as SecuritySeverity[]).map((value) => (
            <option key={value} value={value}>
              {SEVERITY_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select
          label="Type"
          value={eventType}
          onChange={(event) => filter(setEventType)(event.target.value)}
        >
          <option value="">Tous les types</option>
          {Object.entries(SECURITY_EVENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {state.kind === 'error' ? (
        <ApiErrorState
          status={state.status}
          message="Impossible de charger les événements de sécurité."
          onRetry={retry}
        />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucun événement de sécurité ne correspond à ces critères." />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Date"
                    sortKey="timestamp"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Sévérité"
                    sortKey="severity"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Type"
                    sortKey="eventType"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <TableHead>Source</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.kind === 'loading' ? (
                  <LoadingRows columns={5} />
                ) : (
                  state.result.data.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatAuditDate(event.timestamp)}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={event.severity} />
                      </TableCell>
                      <TableCell>{securityEventLabel(event.eventType)}</TableCell>
                      <TableCell>{event.source}</TableCell>
                      <TableCell className="min-w-[280px]">{event.description}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {state.kind === 'loading'
              ? Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))
              : state.result.data.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col gap-1 rounded-[8px] border border-border bg-background-surface p-4 text-sm"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground-primary">
                        {securityEventLabel(event.eventType)}
                      </span>
                      <SeverityBadge severity={event.severity} />
                    </span>
                    <span className="text-foreground-primary">{event.description}</span>
                    <span className="text-xs tabular-nums text-foreground-secondary">
                      {formatAuditDate(event.timestamp)} · {event.source}
                    </span>
                  </div>
                ))}
          </div>
        </>
      )}
      {state.kind === 'ready' && state.result.total > 0 && (
        <Pager page={page} total={state.result.total} setPage={setPage} unit="événement" />
      )}
    </div>
  );
}

function AuthTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [user, setUser] = useState('');
  const [eventType, setEventType] = useState<AuthEventType | ''>('');
  const [page, setPage] = useState(1);
  const { sorting, params: sortParams } = useAuditSort(AUTH_SORT_KEYS, setPage);
  const { state, retry } = useAuditList<AuthEventItem>(
    '/audit/auth-events',
    { from, to, user, eventType, ...sortParams },
    page,
    sorting.ready,
  );
  const filter = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Period from={from} to={to} setFrom={filter(setFrom)} setTo={filter(setTo)} />
        <Input
          label="Utilisateur"
          value={user}
          onChange={(event) => filter(setUser)(event.target.value)}
        />
        <Select
          label="Type"
          value={eventType}
          onChange={(event) => {
            setEventType(event.target.value as AuthEventType | '');
            setPage(1);
          }}
        >
          <option value="">Tous les types</option>
          {(Object.keys(AUTH_EVENT_LABELS) as AuthEventType[]).map((value) => (
            <option key={value} value={value}>
              {AUTH_EVENT_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
      {state.kind === 'error' ? (
        <ApiErrorState
          status={state.status}
          message="Impossible de charger les authentifications."
          onRetry={retry}
        />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucune authentification ne correspond à ces critères." />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Date"
                    sortKey="timestamp"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Utilisateur"
                    sortKey="user"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Événement"
                    sortKey="eventType"
                    sort={sorting.sort}
                    order={sorting.order}
                    onSort={sorting.toggle}
                  />
                  <TableHead>Méthode</TableHead>
                  <TableHead>Adresse IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.kind === 'loading' ? (
                  <LoadingRows columns={5} />
                ) : (
                  state.result.data.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatAuditDate(event.timestamp)}
                      </TableCell>
                      <TableCell>{event.user?.username ?? '—'}</TableCell>
                      <TableCell>{AUTH_EVENT_LABELS[event.eventType]}</TableCell>
                      <TableCell>
                        {event.authenticationMethod === 'LOCAL' ? 'Local' : 'Active Directory'}
                      </TableCell>
                      <TableCell className="tabular-nums">{event.sourceIp}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {state.kind === 'loading'
              ? Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-20 w-full" />
                ))
              : state.result.data.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col gap-1 rounded-[8px] border border-border bg-background-surface p-4 text-sm"
                  >
                    <span className="font-medium text-foreground-primary">
                      {AUTH_EVENT_LABELS[event.eventType]}
                    </span>
                    <span className="text-foreground-secondary">
                      {event.user?.username ?? '—'} ·{' '}
                      {event.authenticationMethod === 'LOCAL' ? 'Local' : 'Active Directory'}
                    </span>
                    <span className="text-xs tabular-nums text-foreground-secondary">
                      {formatAuditDate(event.timestamp)} · {event.sourceIp}
                    </span>
                  </div>
                ))}
          </div>
        </>
      )}
      {state.kind === 'ready' && state.result.total > 0 && (
        <Pager page={page} total={state.result.total} setPage={setPage} unit="événement" />
      )}
    </div>
  );
}
