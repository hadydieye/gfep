'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/employees/status-badge';
import { SortableHead } from '@/components/ui/sortable-head';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import type { DepartmentDetail } from '@/lib/api/types';
import type { SortOrder } from '@/lib/use-sort';

type Member = DepartmentDetail['employees'][number];
type Key = 'name' | 'position' | 'status';

const COLLATOR = new Intl.Collator('fr', { sensitivity: 'base' });
const VALUE: Record<Key, (member: Member) => string> = {
  name: (m) => `${m.lastName} ${m.firstName}`,
  position: (m) => m.position,
  status: (m) => m.employmentStatus,
};

/** Équipe d'un département : liste courte non paginée, triée côté client (N6). */
export function TeamTable({ employees }: { employees: Member[] }) {
  const [sort, setSort] = useState<Key | null>(null);
  const [order, setOrder] = useState<SortOrder>('asc');

  const rows = useMemo(() => {
    if (!sort) return employees;
    const factor = order === 'asc' ? 1 : -1;
    return [...employees].sort((a, b) => factor * COLLATOR.compare(VALUE[sort](a), VALUE[sort](b)));
  }, [employees, sort, order]);

  const toggle = (key: string) => {
    const next = key as Key;
    setOrder(sort === next && order === 'asc' ? 'desc' : 'asc');
    setSort(next);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="Nom" sortKey="name" sort={sort} order={order} onSort={toggle} />
          <SortableHead label="Poste" sortKey="position" sort={sort} order={order} onSort={toggle} className="hidden sm:table-cell" />
          <SortableHead label="Statut" sortKey="status" sort={sort} order={order} onSort={toggle} />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell>
              <Link href={`/employees/${employee.id}`} className="font-medium hover:text-link hover:underline">
                {employee.firstName} {employee.lastName}
              </Link>
              <span className="block text-xs text-foreground-secondary sm:hidden">{employee.position}</span>
            </TableCell>
            <TableCell className="hidden sm:table-cell">{employee.position}</TableCell>
            <TableCell>
              <StatusBadge status={employee.employmentStatus} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
