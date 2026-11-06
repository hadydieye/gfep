'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SortSelect, SortableHead } from '@/components/ui/sortable-head';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import { applySort, useSort } from '@/lib/use-sort';
import type { Department, InvoiceStatus, PaginatedInvoices } from '@/lib/api/types';
import { INVOICE_STATUS, InvoiceStatusBadge } from './finance-badges';
import { ExportButton } from './export-button';
import { MoneyAmount } from './money-amount';

const PAGE_SIZES = [10, 25, 50, 100];

// Colonnes triables côté serveur (N6)
const SORT_COLUMNS = [
  { key: 'invoiceNumber', label: 'Numéro' },
  { key: 'clientName', label: 'Client' },
  { key: 'department', label: 'Département' },
  { key: 'dueDate', label: 'Échéance' },
  { key: 'amount', label: 'Montant' },
  { key: 'status', label: 'Statut' },
] as const;
const SORT_KEYS = SORT_COLUMNS.map((column) => column.key);
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR');

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; status: number }
  | { kind: 'ready'; result: PaginatedInvoices };

export function InvoicesList() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [departmentId, setDepartmentId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const resetPage = useCallback(() => setPage(1), []);
  const sorting = useSort(SORT_KEYS, resetPage);
  const { ready: sortReady, sort, order } = sorting;

  useEffect(() => {
    void apiFetch<Department[]>('/departments').then((result) => {
      if (result.ok) setDepartments(result.data);
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
      if (status) params.set('status', status);
      if (departmentId) params.set('departmentId', departmentId);
      if (dueFrom) params.set('dueFrom', dueFrom);
      if (dueTo) params.set('dueTo', dueTo);
      const result = await apiFetch<PaginatedInvoices>(`/invoices?${params}`);
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
  }, [page, limit, search, status, departmentId, dueFrom, dueTo, reload, router, sortReady, sort, order]);

  const changeFilter = <Value,>(setter: (value: Value) => void, value: Value) => {
    setter(value);
    setPage(1);
  };
  const retry = () => {
    setState({ kind: 'loading' });
    setReload((value) => value + 1);
  };
  // Filtres et tri courants, sans pagination, pour l'export CSV (N5)
  const exportQuery = new URLSearchParams();
  if (search.trim()) exportQuery.set('search', search.trim());
  if (status) exportQuery.set('status', status);
  if (departmentId) exportQuery.set('departmentId', departmentId);
  if (dueFrom) exportQuery.set('dueFrom', dueFrom);
  if (dueTo) exportQuery.set('dueTo', dueTo);
  applySort(exportQuery, { sort, order });

  const totalPages = state.kind === 'ready' ? Math.max(1, Math.ceil(state.result.total / limit)) : 1;
  const open = (id: string) => router.push(`/finance/invoices/${id}`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground-primary">Factures</h1>
        <ExportButton path="/invoices/export" query={exportQuery} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-foreground-secondary" aria-hidden />
          <Input label="Client" className="pl-9" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} />
        </div>
        <Select label="Statut" value={status} onChange={(event) => changeFilter(setStatus, event.target.value as InvoiceStatus | '')}>
          <option value="">Tous les statuts</option>
          {(Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((value) => (
            <option key={value} value={value}>{INVOICE_STATUS[value].label}</option>
          ))}
        </Select>
        <Select label="Département" value={departmentId} onChange={(event) => changeFilter(setDepartmentId, event.target.value)}>
          <option value="">Tous les départements</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </Select>
        <Input label="Échéance du" type="date" value={dueFrom} max={dueTo || undefined} onChange={(event) => changeFilter(setDueFrom, event.target.value)} />
        <Input label="Échéance au" type="date" value={dueTo} min={dueFrom || undefined} onChange={(event) => changeFilter(setDueTo, event.target.value)} />
        <SortSelect className="md:hidden" options={SORT_COLUMNS} sort={sort} order={order} onSelect={sorting.setSort} />
      </div>

      {state.kind === 'error' ? (
        <ApiErrorState status={state.status} message="Impossible de charger les factures." onRetry={retry} />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucune facture ne correspond à ces critères." />
      ) : (
        <>
          <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Numéro" sortKey="invoiceNumber" sort={sort} order={order} onSort={sorting.toggle} />
                  <SortableHead label="Client" sortKey="clientName" sort={sort} order={order} onSort={sorting.toggle} />
                  <SortableHead label="Département" sortKey="department" sort={sort} order={order} onSort={sorting.toggle} />
                  <SortableHead label="Échéance" sortKey="dueDate" sort={sort} order={order} onSort={sorting.toggle} />
                  <SortableHead label="Montant" sortKey="amount" sort={sort} order={order} onSort={sorting.toggle} className="text-right" />
                  <SortableHead label="Statut" sortKey="status" sort={sort} order={order} onSort={sorting.toggle} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.kind === 'loading'
                  ? Array.from({ length: 5 }, (_, index) => (
                    <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell></TableRow>
                  ))
                  : state.result.data.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => open(invoice.id)}
                      onKeyDown={(event) => event.key === 'Enter' && open(invoice.id)}
                    >
                      <TableCell className="font-medium tabular-nums">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.clientName}</TableCell>
                      <TableCell>{invoice.department?.name ?? '—'}</TableCell>
                      <TableCell>{DATE_FORMAT.format(new Date(invoice.dueDate))}</TableCell>
                      <TableCell className="text-right"><MoneyAmount amount={invoice.amount} currency={invoice.currency} /></TableCell>
                      <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {state.kind === 'loading'
              ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 w-full" />)
              : state.result.data.map((invoice) => (
                <Link key={invoice.id} href={`/finance/invoices/${invoice.id}`} className="flex flex-col gap-2 rounded-[8px] border border-border bg-background-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium tabular-nums text-foreground-primary">{invoice.invoiceNumber}</span>
                    <MoneyAmount amount={invoice.amount} currency={invoice.currency} className="font-medium text-foreground-primary" />
                  </div>
                  <span className="text-sm text-foreground-secondary">
                    {invoice.clientName} · échéance {DATE_FORMAT.format(new Date(invoice.dueDate))}
                  </span>
                  <span><InvoiceStatusBadge status={invoice.status} /></span>
                </Link>
              ))}
          </div>
        </>
      )}

      {state.kind === 'ready' && state.result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground-secondary">
          <span>{state.result.total} facture{state.result.total === 1 ? '' : 's'}</span>
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
    </div>
  );
}
