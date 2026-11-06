'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { ChevronLeft, ChevronRight, KeyRound, LockOpen, Search, UserCheck, UserX } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SortSelect, SortableHead } from '@/components/ui/sortable-head';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import { applySort, useSort } from '@/lib/use-sort';
import type { Account, AuthProvider, PaginatedAccounts, RoleSummary, UserStatus } from '@/lib/api/types';
import { ACCOUNT_STATUS, AUTH_PROVIDER_LABELS, AccountStatusBadge, RoleBadge, roleLabel } from './access-labels';

const PAGE_SIZES = [10, 25, 50, 100];

// Colonnes triables côté serveur (N6)
const SORT_COLUMNS = [
  { key: 'username', label: 'Identifiant' },
  { key: 'status', label: 'Statut' },
  { key: 'authProvider', label: 'Méthode' },
  { key: 'lastLoginAt', label: 'Dernière connexion' },
  { key: 'createdAt', label: 'Date de création' },
] as const;
const SORT_KEYS = SORT_COLUMNS.map((column) => column.key);
const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; status: number }
  | { kind: 'ready'; result: PaginatedAccounts };

type PendingAction =
  | { kind: 'roles'; account: Account; roleIds: string[] }
  | { kind: 'status'; account: Account; status: 'ACTIVE' | 'SUSPENDED' }
  | { kind: 'unlock'; account: Account };

/**
 * Comptes applicatifs (AppFlow §3.8, M17). Aucune création de compte. Les actions
 * interdites par les garde-fous ne sont pas rendues ; le serveur reste seul juge.
 */
export function AccountsList({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [search, setSearch] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [provider, setProvider] = useState<AuthProvider | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const resetPage = useCallback(() => setPage(1), []);
  const sorting = useSort(SORT_KEYS, resetPage);
  const { ready: sortReady, sort, order } = sorting;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch<RoleSummary[]>('/access/roles').then((result) => {
      if (result.ok) setRoles(result.data);
    });
  }, []);

  useEffect(() => {
    if (!sortReady) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setState({ kind: 'loading' });
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      applySort(params, { sort, order });
      if (search.trim()) params.set('search', search.trim());
      if (roleId) params.set('roleId', roleId);
      if (status) params.set('status', status);
      if (provider) params.set('authProvider', provider);
      const result = await apiFetch<PaginatedAccounts>(`/access/users?${params}`);
      if (!active) return;
      if (!result.ok && result.status === 401) {
        router.push('/login');
        return;
      }
      setState(result.ok ? { kind: 'ready', result: result.data } : { kind: 'error', status: result.status });
    }, search ? 200 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [page, limit, search, roleId, status, provider, reload, router, sortReady, sort, order]);

  const changeFilter = <Value,>(setter: (value: Value) => void, value: Value) => {
    setter(value);
    setPage(1);
  };
  const refresh = () => {
    setState({ kind: 'loading' });
    setReload((value) => value + 1);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    const { account } = pending;
    const result =
      pending.kind === 'roles'
        ? await apiFetch<Account>(`/access/users/${account.id}/roles`, {
          method: 'PUT',
          body: JSON.stringify({ roleIds: pending.roleIds }),
        })
        : pending.kind === 'status'
          ? await apiFetch<Account>(`/access/users/${account.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: pending.status }),
          })
          : await apiFetch<Account>(`/access/users/${account.id}/unlock`, { method: 'POST' });
    setBusy(false);
    setPending(null);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else if (result.status === 403) toast.error('Cette action n’est pas autorisée sur ce compte.');
      else toast.error(result.message ?? 'L’action n’a pas pu être enregistrée.');
      return;
    }
    toast.success(
      pending.kind === 'roles'
        ? `Les rôles de ${account.username} sont à jour.`
        : pending.kind === 'unlock'
          ? `Le compte ${account.username} est déverrouillé.`
          : pending.status === 'SUSPENDED'
            ? `Le compte ${account.username} est suspendu.`
            : `Le compte ${account.username} est réactivé.`,
    );
    refresh();
  };

  const toggleRole = (id: string, checked: boolean) => {
    if (pending?.kind !== 'roles') return;
    const roleIds = checked ? [...pending.roleIds, id] : pending.roleIds.filter((value) => value !== id);
    setPending({ ...pending, roleIds });
  };

  const actions = (account: Account) => {
    const { canAssignRoles, canChangeStatus, canUnlock } = account.capabilities;
    if (!canAssignRoles && !canChangeStatus && !canUnlock) return null;
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {canAssignRoles && (
          <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'roles', account, roleIds: account.roles.map((r) => r.id) })}>
            <KeyRound className="h-4 w-4" aria-hidden />
            Rôles
          </Button>
        )}
        {canUnlock && (
          <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'unlock', account })}>
            <LockOpen className="h-4 w-4" aria-hidden />
            Déverrouiller
          </Button>
        )}
        {canChangeStatus && account.status !== 'SUSPENDED' && (
          <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'status', account, status: 'SUSPENDED' })}>
            <UserX className="h-4 w-4" aria-hidden />
            Suspendre
          </Button>
        )}
        {canChangeStatus && account.status === 'SUSPENDED' && (
          <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'status', account, status: 'ACTIVE' })}>
            <UserCheck className="h-4 w-4" aria-hidden />
            Réactiver
          </Button>
        )}
      </div>
    );
  };

  const totalPages = state.kind === 'ready' ? Math.max(1, Math.ceil(state.result.total / limit)) : 1;
  const dialog = pending ? dialogText(pending) : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground-primary">Comptes</h1>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-foreground-secondary" aria-hidden />
          <Input label="Rechercher" className="pl-9" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} />
        </div>
        <Select label="Rôle" value={roleId} onChange={(event) => changeFilter(setRoleId, event.target.value)}>
          <option value="">Tous les rôles</option>
          {roles.map((role) => <option key={role.id} value={role.id}>{roleLabel(role.name)}</option>)}
        </Select>
        <Select label="Statut" value={status} onChange={(event) => changeFilter(setStatus, event.target.value as UserStatus | '')}>
          <option value="">Tous les statuts</option>
          {(Object.keys(ACCOUNT_STATUS) as UserStatus[]).map((value) => (
            <option key={value} value={value}>{ACCOUNT_STATUS[value].label}</option>
          ))}
        </Select>
        <Select label="Méthode" value={provider} onChange={(event) => changeFilter(setProvider, event.target.value as AuthProvider | '')}>
          <option value="">Toutes les méthodes</option>
          <option value="LOCAL">Local</option>
          <option value="ACTIVE_DIRECTORY">Active Directory</option>
        </Select>
        <SortSelect className="md:hidden" options={SORT_COLUMNS} sort={sort} order={order} onSelect={sorting.setSort} />
      </div>

      {state.kind === 'error' ? (
        <ApiErrorState status={state.status} message="Impossible de charger les comptes." onRetry={refresh} />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucun compte ne correspond à ces critères." />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <SortableHead label="Identifiant" sortKey="username" sort={sort} order={order} onSort={sorting.toggle} />
                  <TableHead>Rôles</TableHead>
                  <SortableHead label="Statut" sortKey="status" sort={sort} order={order} onSort={sorting.toggle} />
                  <SortableHead label="Méthode" sortKey="authProvider" sort={sort} order={order} onSort={sorting.toggle} />
                  <SortableHead label="Dernière connexion" sortKey="lastLoginAt" sort={sort} order={order} onSort={sorting.toggle} />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.kind === 'loading'
                  ? Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                  ))
                  : state.result.data.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.displayName ?? '—'}</TableCell>
                      <TableCell>{account.username}</TableCell>
                      <TableCell><span className="flex flex-wrap gap-1">{account.roles.map((role) => <RoleBadge key={role.id} name={role.name} />)}</span></TableCell>
                      <TableCell><AccountStatusBadge status={account.status} /></TableCell>
                      <TableCell>{AUTH_PROVIDER_LABELS[account.authProvider]}</TableCell>
                      <TableCell>{account.lastLoginAt ? DATE_TIME.format(new Date(account.lastLoginAt)) : 'Jamais'}</TableCell>
                      <TableCell>{actions(account)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {state.kind === 'loading'
              ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 w-full" />)
              : state.result.data.map((account) => (
                <div key={account.id} className="flex flex-col gap-2 rounded-[8px] border border-border bg-background-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium text-foreground-primary">{account.displayName ?? account.username}</span>
                    <AccountStatusBadge status={account.status} />
                  </div>
                  <span className="text-sm text-foreground-secondary">{account.username} · {AUTH_PROVIDER_LABELS[account.authProvider]}</span>
                  <span className="flex flex-wrap gap-1">{account.roles.map((role) => <RoleBadge key={role.id} name={role.name} />)}</span>
                  {actions(account)}
                </div>
              ))}
          </div>
        </>
      )}

      {state.kind === 'ready' && state.result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground-secondary">
          <span>{state.result.total} compte{state.result.total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" aria-label="Page précédente" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
            <span aria-live="polite">Page {page} sur {totalPages}</span>
            <Button variant="secondary" size="icon" aria-label="Page suivante" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" aria-hidden /></Button>
          </div>
          <label className="flex items-center gap-2">Par page
            <select className="h-8 rounded-md border border-foreground-secondary bg-background-surface px-2 text-foreground-primary" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}>
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={dialog?.title ?? ''}
        description={dialog?.description ?? ''}
        confirmLabel={dialog?.confirmLabel ?? 'Confirmer'}
        destructive={pending?.kind === 'status' && pending.status === 'SUSPENDED'}
        busy={busy || (pending?.kind === 'roles' && pending.roleIds.length === 0)}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={confirm}
      >
        {pending?.kind === 'roles' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Rôles du compte</legend>
            {roles.map((role) => (
              <Checkbox
                key={role.id}
                label={roleLabel(role.name)}
                // Seul un SUPER_ADMIN attribue ou retire le rôle SUPER_ADMIN (M17)
                disabled={role.name === 'SUPER_ADMIN' && !isSuperAdmin}
                checked={pending.roleIds.includes(role.id)}
                onChange={(event) => toggleRole(role.id, event.target.checked)}
              />
            ))}
            {pending.roleIds.length === 0 && (
              <p role="alert" className="text-xs text-error dark:text-error-dark">Sélectionnez au moins un rôle.</p>
            )}
          </fieldset>
        )}
      </ConfirmDialog>
    </div>
  );
}

function dialogText(pending: PendingAction) {
  const name = pending.account.displayName ?? pending.account.username;
  if (pending.kind === 'roles') {
    return {
      title: `Rôles de ${name}`,
      description: 'Les droits du compte changent dès l’enregistrement.',
      confirmLabel: 'Enregistrer',
    };
  }
  if (pending.kind === 'unlock') {
    return {
      title: `Déverrouiller ${name}`,
      description: 'Le compte redevient actif et son compteur d’échecs de connexion est remis à zéro.',
      confirmLabel: 'Déverrouiller',
    };
  }
  return pending.status === 'SUSPENDED'
    ? {
      title: `Suspendre ${name}`,
      description: 'Le compte ne pourra plus se connecter et toutes ses sessions seront fermées immédiatement.',
      confirmLabel: 'Suspendre',
    }
    : {
      title: `Réactiver ${name}`,
      description: 'Le compte pourra de nouveau se connecter.',
      confirmLabel: 'Réactiver',
    };
}
