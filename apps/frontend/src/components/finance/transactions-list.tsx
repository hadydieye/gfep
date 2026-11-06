'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import type {
  Department,
  PaginatedTransactions,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@/lib/api/types';
import { TRANSACTION_TYPE_LABEL, TransactionStatusBadge } from './finance-badges';
import { MoneyAmount } from './money-amount';

const PAGE_SIZES = [10, 25, 50, 100];

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; status: number }
  | { kind: 'ready'; result: PaginatedTransactions };

type Decision = { transaction: Transaction; status: 'VALIDATED' | 'REJECTED' };

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR');

export function TransactionsList({ canCreate, canValidate }: { canCreate: boolean; canValidate: boolean }) {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionType | ''>('');
  const [status, setStatus] = useState<TransactionStatus | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [decision, setDecision] = useState<Decision | null>(null);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    void apiFetch<Department[]>('/departments').then((result) => {
      if (result.ok) setDepartments(result.data);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setState({ kind: 'loading' });
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search.trim()) params.set('search', search.trim());
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      if (departmentId) params.set('departmentId', departmentId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const result = await apiFetch<PaginatedTransactions>(`/transactions?${params}`);
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
  }, [page, limit, search, type, status, departmentId, from, to, reload, router]);

  const changeFilter = <Value,>(setter: (value: Value) => void, value: Value) => {
    setter(value);
    setPage(1);
  };
  const refresh = () => {
    setState({ kind: 'loading' });
    setReload((value) => value + 1);
  };

  const confirmDecision = async () => {
    if (!decision) return;
    setDeciding(true);
    const result = await apiFetch<Transaction>(`/transactions/${decision.transaction.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: decision.status }),
    });
    setDeciding(false);
    setDecision(null);
    if (!result.ok) {
      if (result.status === 401) router.push('/login');
      else toast.error(result.message ?? 'La décision n’a pas pu être enregistrée.');
      return;
    }
    toast.success(
      decision.status === 'VALIDATED'
        ? `La transaction ${result.data.reference} a été validée.`
        : `La transaction ${result.data.reference} a été rejetée.`,
    );
    refresh();
  };

  const totalPages = state.kind === 'ready' ? Math.max(1, Math.ceil(state.result.total / limit)) : 1;
  const columns = canValidate ? 8 : 7;
  const decisionButtons = (transaction: Transaction) =>
    canValidate && transaction.status === 'PENDING' ? (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setDecision({ transaction, status: 'VALIDATED' })}>
          <Check className="h-4 w-4" aria-hidden />
          Valider
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setDecision({ transaction, status: 'REJECTED' })}>
          <X className="h-4 w-4" aria-hidden />
          Rejeter
        </Button>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground-primary">Transactions</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/finance/transactions/new">
              <Plus className="h-4 w-4" aria-hidden />
              Nouvelle transaction
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-foreground-secondary" aria-hidden />
          <Input
            label="Référence"
            className="pl-9"
            value={search}
            onChange={(event) => changeFilter(setSearch, event.target.value)}
          />
        </div>
        <Select label="Type" value={type} onChange={(event) => changeFilter(setType, event.target.value as TransactionType | '')}>
          <option value="">Tous les types</option>
          <option value="INCOME">Recette</option>
          <option value="EXPENSE">Dépense</option>
        </Select>
        <Select label="Statut" value={status} onChange={(event) => changeFilter(setStatus, event.target.value as TransactionStatus | '')}>
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="VALIDATED">Validée</option>
          <option value="REJECTED">Rejetée</option>
        </Select>
        <Select label="Département" value={departmentId} onChange={(event) => changeFilter(setDepartmentId, event.target.value)}>
          <option value="">Tous les départements</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </Select>
        <Input label="Du" type="date" value={from} max={to || undefined} onChange={(event) => changeFilter(setFrom, event.target.value)} />
        <Input label="Au" type="date" value={to} min={from || undefined} onChange={(event) => changeFilter(setTo, event.target.value)} />
      </div>

      {state.kind === 'error' ? (
        <ApiErrorState status={state.status} message="Impossible de charger les transactions." onRetry={refresh} />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucune transaction ne correspond à ces critères.">
          {canCreate && (
            <Button asChild variant="secondary">
              <Link href="/finance/transactions/new"><Plus className="h-4 w-4" aria-hidden />Nouvelle transaction</Link>
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  {canValidate && <TableHead className="text-right">Décision</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.kind === 'loading'
                  ? Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}><TableCell colSpan={columns}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                  ))
                  : state.result.data.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium tabular-nums">{transaction.reference}</TableCell>
                      <TableCell>{DATE_FORMAT.format(new Date(transaction.createdAt))}</TableCell>
                      <TableCell>{TRANSACTION_TYPE_LABEL[transaction.transactionType]}</TableCell>
                      <TableCell>{transaction.department?.name ?? '—'}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{transaction.description ?? '—'}</TableCell>
                      <TableCell className="text-right"><MoneyAmount amount={transaction.amount} currency={transaction.currency} /></TableCell>
                      <TableCell><TransactionStatusBadge status={transaction.status} /></TableCell>
                      {canValidate && <TableCell>{decisionButtons(transaction)}</TableCell>}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {state.kind === 'loading'
              ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 w-full" />)
              : state.result.data.map((transaction) => (
                <div key={transaction.id} className="flex flex-col gap-2 rounded-[8px] border border-border bg-background-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium tabular-nums text-foreground-primary">{transaction.reference}</span>
                    <MoneyAmount amount={transaction.amount} currency={transaction.currency} className="font-medium text-foreground-primary" />
                  </div>
                  <span className="text-sm text-foreground-secondary">
                    {TRANSACTION_TYPE_LABEL[transaction.transactionType]} · {transaction.department?.name ?? '—'} · {DATE_FORMAT.format(new Date(transaction.createdAt))}
                  </span>
                  <span><TransactionStatusBadge status={transaction.status} /></span>
                  {decisionButtons(transaction)}
                </div>
              ))}
          </div>
        </>
      )}

      {state.kind === 'ready' && state.result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground-secondary">
          <span>{state.result.total} transaction{state.result.total === 1 ? '' : 's'}</span>
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
        open={decision !== null}
        title={decision?.status === 'VALIDATED' ? 'Valider la transaction' : 'Rejeter la transaction'}
        description={
          decision
            ? `${decision.status === 'VALIDATED' ? 'Valider' : 'Rejeter'} la transaction ${decision.transaction.reference} ? Cette décision est définitive.`
            : ''
        }
        confirmLabel={decision?.status === 'VALIDATED' ? 'Valider' : 'Rejeter'}
        destructive={decision?.status === 'REJECTED'}
        busy={deciding}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        onConfirm={confirmDecision}
      />
    </div>
  );
}
