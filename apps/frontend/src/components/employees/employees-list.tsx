'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api/client';
import type { Department, EmploymentStatus, PaginatedEmployees } from '@/lib/api/types';
import { STATUS_LABELS, StatusBadge, formatDate } from './status-badge';

const PAGE_SIZES = [10, 25, 50, 100];
const COLUMNS = ['Nom complet', 'Département', 'Poste', 'Statut', "Date d'embauche"];

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; status: number }
  | { kind: 'ready'; result: PaginatedEmployees };

export function EmployeesList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<EmploymentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [state, setState] = useState<ListState>({ kind: 'loading' });

  useEffect(() => {
    void apiFetch<Department[]>('/departments').then((r) => r.ok && setDepartments(r.data));
  }, []);

  // Recherche différée pour éviter une requête à chaque frappe
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set('search', search);
    if (departmentId) params.set('departmentId', departmentId);
    if (status) params.set('status', status);
    const result = await apiFetch<PaginatedEmployees>(`/employees?${params}`);
    if (!result.ok && result.status === 401) {
      router.push('/login');
      return;
    }
    setState(result.ok ? { kind: 'ready', result: result.data } : { kind: 'error', status: result.status });
  }, [page, limit, search, departmentId, status, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages =
    state.kind === 'ready' ? Math.max(1, Math.ceil(state.result.total / state.result.limit)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground-primary">Employés</h1>
        {canCreate && (
          <Button asChild>
            <Link href="/employees/new">
              <UserPlus className="h-4 w-4" aria-hidden />
              Nouvel employé
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-foreground-secondary" aria-hidden />
          <Input
            label="Rechercher"
            placeholder="Nom ou prénom"
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          label="Département"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les départements</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          label="Statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EmploymentStatus | '');
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {state.kind === 'error' ? (
        <ApiErrorState
          status={state.status}
          message="Impossible de charger les employés."
          onRetry={() => void load()}
        />
      ) : state.kind === 'ready' && state.result.data.length === 0 ? (
        <EmptyState message="Aucun employé trouvé" />
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-[8px] border border-border bg-background-surface">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.kind === 'loading'
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i} aria-hidden>
                      {COLUMNS.map((column) => (
                        <TableCell key={column}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : state.result.data.map((employee) => (
                    <TableRow
                      key={employee.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => router.push(`/employees/${employee.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && router.push(`/employees/${employee.id}`)}
                    >
                      <TableCell className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </TableCell>
                      <TableCell>{employee.department.name}</TableCell>
                      <TableCell>{employee.position.title}</TableCell>
                      <TableCell>
                        <StatusBadge status={employee.employmentStatus} />
                      </TableCell>
                      <TableCell>{formatDate(employee.hireDate)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}

      {state.kind === 'ready' && state.result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-foreground-secondary">
          <span>
            {state.result.total} employé{state.result.total > 1 ? 's' : ''}
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                variant={n === page ? 'primary' : 'secondary'}
                size="icon"
                aria-current={n === page ? 'page' : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
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
              onChange={(e) => {
                setLimit(Number(e.target.value));
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
