'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { Check, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api/client';
import type { NotificationItem, PaginatedNotifications } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { NOTIFICATION_META, NotificationIcon, formatNotificationDate, notifyNotificationsChanged } from './notification-meta';

type Filter = 'all' | 'unread' | 'read';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'unread', label: 'Non lues' },
  { value: 'read', label: 'Lues' },
];
const PAGE_SIZE = 20;

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; status: number }
  | { kind: 'ready'; result: PaginatedNotifications };

/** Notifications de l'utilisateur connecté uniquement (AppFlow §3.9, design §7.3). */
export function NotificationsList() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setState({ kind: 'loading' });
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (filter !== 'all') params.set('status', filter);
      const result = await apiFetch<PaginatedNotifications>(`/notifications?${params}`);
      if (!active) return;
      if (!result.ok && result.status === 401) {
        router.push('/login');
        return;
      }
      setState(result.ok ? { kind: 'ready', result: result.data } : { kind: 'error', status: result.status });
    })();
    return () => {
      active = false;
    };
  }, [filter, page, reload, router]);

  const refresh = () => setReload((value) => value + 1);

  const markRead = async (notification: NotificationItem) => {
    const result = await apiFetch<NotificationItem>(`/notifications/${notification.id}/read`, { method: 'PATCH' });
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else toast.error(result.message ?? 'La notification n’a pas pu être marquée comme lue.');
      return;
    }
    notifyNotificationsChanged();
    refresh();
  };

  const markAllRead = async () => {
    setBusy(true);
    const result = await apiFetch<{ updated: number }>('/notifications/read-all', { method: 'POST' });
    setBusy(false);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else toast.error(result.message ?? 'Les notifications n’ont pas pu être marquées comme lues.');
      return;
    }
    toast.success(
      result.data.updated === 0
        ? 'Toutes vos notifications étaient déjà lues.'
        : `${result.data.updated} notification${result.data.updated === 1 ? '' : 's'} marquée${result.data.updated === 1 ? '' : 's'} comme lue${result.data.updated === 1 ? '' : 's'}.`,
    );
    notifyNotificationsChanged();
    refresh();
  };

  const totalPages = state.kind === 'ready' ? Math.max(1, Math.ceil(state.result.total / PAGE_SIZE)) : 1;
  const emptyMessage =
    filter === 'unread' ? 'Aucune notification non lue.' : filter === 'read' ? 'Aucune notification lue.' : 'Vous n’avez aucune notification.';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground-primary">Notifications</h1>
        <Button variant="secondary" onClick={markAllRead} disabled={busy}>
          <CheckCheck className="h-4 w-4" aria-hidden />
          Tout marquer comme lu
        </Button>
      </div>

      <div role="group" aria-label="Filtrer les notifications" className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={filter === option.value ? 'primary' : 'secondary'}
            aria-pressed={filter === option.value}
            onClick={() => {
              setFilter(option.value);
              setPage(1);
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {state.kind === 'error' ? (
        <ApiErrorState status={state.status} message="Impossible de charger vos notifications." onRetry={refresh} />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-[8px] border border-border bg-background-surface">
          {state.kind === 'loading'
            ? Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="flex gap-3 p-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </li>
            ))
            : state.result.data.map((notification) => {
              const unread = notification.readAt === null;
              return (
                <li key={notification.id} className={cn('flex gap-3 p-4', unread && 'bg-primary/5')}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background-main text-foreground-secondary">
                    <NotificationIcon type={notification.type} className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className={cn('text-sm text-foreground-primary', unread ? 'font-semibold' : 'font-medium')}>
                        {unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-link align-middle" aria-hidden />}
                        {notification.title}
                        <span className="sr-only">{unread ? ' (non lue)' : ' (lue)'}</span>
                      </p>
                      <time className="text-xs text-foreground-secondary" dateTime={notification.createdAt}>
                        {formatNotificationDate(notification.createdAt)}
                      </time>
                    </div>
                    <p className="text-sm text-foreground-secondary">{notification.message}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-foreground-secondary">{NOTIFICATION_META[notification.type].label}</span>
                      {unread && (
                        <Button size="sm" variant="secondary" onClick={() => markRead(notification)}>
                          <Check className="h-4 w-4" aria-hidden />
                          Marquer comme lu
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      {state.kind === 'ready' && state.result.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-1 text-sm text-foreground-secondary">
          <Button variant="secondary" size="icon" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <span aria-live="polite">Page {page} sur {totalPages}</span>
          <Button variant="secondary" size="icon" aria-label="Page suivante" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
