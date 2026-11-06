'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search, Upload, X } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { SortSelect, SortableHead } from '@/components/ui/sortable-head';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import { applySort, useSort } from '@/lib/use-sort';
import type {
  ConfidentialityLevel,
  DocumentCategory,
  PaginatedDocuments,
  DocumentValidationStatus,
} from '@/lib/api/types';
import { ConfidentialityBadge, ValidationBadge } from './document-badges';

const PAGE_SIZES = [10, 25, 50, 100];

// Colonnes triables côté serveur (N6) ; « Département » est calculé (M8), non triable
const SORT_COLUMNS = [
  { key: 'title', label: 'Titre' },
  { key: 'category', label: 'Catégorie' },
  { key: 'confidentiality', label: 'Confidentialité' },
  { key: 'validationStatus', label: 'Validation' },
  { key: 'createdAt', label: 'Ajouté le' },
] as const;
const SORT_KEYS = SORT_COLUMNS.map((column) => column.key);

/** Filtres d'arrivée depuis une fiche employé ou un département (N11). */
interface ScopeFilter {
  param: 'ownerId' | 'departmentId';
  id: string;
  label: string;
}

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; status: number }
  | { kind: 'ready'; result: PaginatedDocuments };

export function DocumentsList({ scope = null }: { scope?: ScopeFilter | null }) {
  const router = useRouter();
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [confidentiality, setConfidentiality] = useState<ConfidentialityLevel | ''>('');
  const [validation, setValidation] = useState<DocumentValidationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [activeScope, setActiveScope] = useState<ScopeFilter | null>(scope);
  const resetPage = useCallback(() => setPage(1), []);
  const sorting = useSort(SORT_KEYS, resetPage);
  const { ready: sortReady, sort, order } = sorting;

  useEffect(() => {
    void apiFetch<DocumentCategory[]>('/documents/categories').then((result) => {
      if (result.ok) setCategories(result.data);
    });
  }, []);

  useEffect(() => {
    if (!sortReady) return;
    let active = true;
    const timer = window.setTimeout(
      async () => {
        setState({ kind: 'loading' });
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search.trim()) params.set('search', search.trim());
        if (categoryId) params.set('categoryId', categoryId);
        if (confidentiality) params.set('confidentialityLevel', confidentiality);
        if (validation) params.set('validationStatus', validation);
        if (activeScope) params.set(activeScope.param, activeScope.id);
        applySort(params, { sort, order });
        const result = await apiFetch<PaginatedDocuments>(`/documents?${params}`);
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
      },
      search ? 200 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    page,
    limit,
    search,
    categoryId,
    confidentiality,
    validation,
    reload,
    router,
    sortReady,
    sort,
    order,
    activeScope,
  ]);

  const changeFilter = <Value,>(setter: (value: Value) => void, value: Value) => {
    setter(value);
    setPage(1);
  };
  const retry = () => {
    setState({ kind: 'loading' });
    setReload((value) => value + 1);
  };
  const totalPages =
    state.kind === 'ready' ? Math.max(1, Math.ceil(state.result.total / limit)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground-primary">Documents</h1>
        <Button asChild>
          <Link href="/documents/upload">
            <Upload className="h-4 w-4" aria-hidden />
            Déposer un document
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-foreground-secondary"
            aria-hidden
          />
          <Input
            label="Rechercher"
            className="pl-9"
            value={search}
            onChange={(event) => changeFilter(setSearch, event.target.value)}
          />
        </div>
        <Select
          label="Catégorie"
          value={categoryId}
          onChange={(event) => changeFilter(setCategoryId, event.target.value)}
        >
          <option value="">Toutes les catégories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          label="Confidentialité"
          value={confidentiality}
          onChange={(event) =>
            changeFilter(setConfidentiality, event.target.value as ConfidentialityLevel | '')
          }
        >
          <option value="">Tous les niveaux</option>
          <option value="PUBLIC">Public</option>
          <option value="INTERNAL">Interne</option>
          <option value="CONFIDENTIAL">Confidentiel</option>
          <option value="RESTRICTED">Restreint</option>
        </Select>
        <Select
          label="Validation"
          value={validation}
          onChange={(event) =>
            changeFilter(setValidation, event.target.value as DocumentValidationStatus | '')
          }
        >
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="VALIDATED">Validé</option>
          <option value="REJECTED">Rejeté</option>
        </Select>
        <SortSelect
          className="md:hidden"
          options={SORT_COLUMNS}
          sort={sort}
          order={order}
          onSelect={sorting.setSort}
        />
      </div>

      {activeScope && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-secondary">
          Filtre actif :
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background-surface py-1 pl-3 pr-1 text-foreground-primary">
            {activeScope.label}
            <button
              type="button"
              aria-label={`Retirer le filtre ${activeScope.label}`}
              className="rounded-full p-1 hover:bg-background-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link"
              onClick={() => {
                setActiveScope(null);
                setPage(1);
                const params = new URLSearchParams(window.location.search);
                params.delete(activeScope.param);
                const query = params.toString();
                window.history.replaceState(
                  window.history.state,
                  '',
                  `${window.location.pathname}${query ? `?${query}` : ''}`,
                );
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </span>
        </div>
      )}

      {state.kind === 'error' ? (
        <ApiErrorState
          status={state.status}
          message="Impossible de charger les documents."
          onRetry={retry}
        />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucun document ne correspond à ces critères.">
          <Button asChild variant="secondary">
            <Link href="/documents/upload">
              <Upload className="h-4 w-4" aria-hidden />
              Déposer un document
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="hidden overflow-auto rounded-[8px] border border-border bg-background-surface md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Titre"
                    sortKey="title"
                    sort={sort}
                    order={order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Catégorie"
                    sortKey="category"
                    sort={sort}
                    order={order}
                    onSort={sorting.toggle}
                  />
                  <TableHead>Département</TableHead>
                  <SortableHead
                    label="Confidentialité"
                    sortKey="confidentiality"
                    sort={sort}
                    order={order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Validation"
                    sortKey="validationStatus"
                    sort={sort}
                    order={order}
                    onSort={sorting.toggle}
                  />
                  <SortableHead
                    label="Ajouté le"
                    sortKey="createdAt"
                    sort={sort}
                    order={order}
                    onSort={sorting.toggle}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.kind === 'loading'
                  ? Array.from({ length: 5 }, (_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : state.result.data.map((document) => (
                      <TableRow
                        key={document.id}
                        className="cursor-pointer"
                        tabIndex={0}
                        onClick={() => router.push(`/documents/${document.id}`)}
                        onKeyDown={(event) =>
                          event.key === 'Enter' && router.push(`/documents/${document.id}`)
                        }
                      >
                        <TableCell className="font-medium">{document.title}</TableCell>
                        <TableCell>{document.category.name}</TableCell>
                        <TableCell>{document.department.name}</TableCell>
                        <TableCell>
                          <ConfidentialityBadge level={document.confidentialityLevel} />
                        </TableCell>
                        <TableCell>
                          <ValidationBadge status={document.validationStatus} />
                        </TableCell>
                        <TableCell>
                          {new Intl.DateTimeFormat('fr-FR').format(new Date(document.createdAt))}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {state.kind === 'loading'
              ? Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-28 w-full" />
                ))
              : state.result.data.map((document) => (
                  <Link
                    key={document.id}
                    href={`/documents/${document.id}`}
                    className="flex flex-col gap-2 rounded-[8px] border border-border bg-background-surface p-4"
                  >
                    <span className="font-medium text-foreground-primary">{document.title}</span>
                    <span className="text-sm text-foreground-secondary">
                      {document.category.name} · {document.department.name}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <ConfidentialityBadge level={document.confidentialityLevel} />
                      <ValidationBadge status={document.validationStatus} />
                    </span>
                  </Link>
                ))}
          </div>
        </>
      )}

      {state.kind === 'ready' && state.result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground-secondary">
          <span>
            {state.result.total} document{state.result.total === 1 ? '' : 's'}
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
              Page {page} sur {totalPages}
            </span>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Page suivante"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <label className="flex items-center gap-2">
            Par page
            <select
              className="h-8 rounded-md border border-foreground-secondary bg-background-surface px-2 text-foreground-primary"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
