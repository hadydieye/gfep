import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { DepartmentIcon } from '@/components/departments/department-icon';
import { StatusBadge } from '@/components/employees/status-badge';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiGet } from '@/lib/api/server';
import type { DepartmentDetail } from '@/lib/api/types';

const CARD = 'rounded-[8px] border border-border bg-background-surface p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]';

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<DepartmentDetail>(`/departments/${id}`);
  if (!result.ok && result.status === 401) {
    redirect('/login');
  }
  if (!result.ok) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Départements', href: '/departments' }, { label: 'Détail' }]} />
        <ApiErrorState status={result.status} message="Impossible de charger ce département." />
      </>
    );
  }

  const department = result.data;
  return (
    <div>
      <Breadcrumb items={[{ label: 'Départements', href: '/departments' }, { label: department.name }]} />
      <div className="mb-6 flex items-center gap-4">
        <span className="rounded-md bg-primary/10 p-3 text-link">
          <DepartmentIcon code={department.code} className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground-primary">{department.name}</h1>
          <p className="text-sm text-foreground-secondary">
            {department.code} · {department.headcount} employé{department.headcount > 1 ? 's' : ''}{' '}
            actif{department.headcount > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <section className={CARD}>
          <h2 className="mb-4 text-base font-semibold text-foreground-primary">Responsable</h2>
          {department.manager ? (
            <div className="flex items-center gap-3">
              <UserRound className="h-8 w-8 text-foreground-secondary" aria-hidden />
              <div>
                <Link
                  href={`/employees/${department.manager.id}`}
                  className="font-medium text-link hover:underline"
                >
                  {department.manager.firstName} {department.manager.lastName}
                </Link>
                <p className="text-sm text-foreground-secondary">{department.manager.position}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground-secondary">Aucun responsable désigné.</p>
          )}
        </section>

        <section className={CARD}>
          <h2 className="mb-4 text-base font-semibold text-foreground-primary">Équipe</h2>
          {department.employees.length === 0 ? (
            <EmptyState message="Aucun employé actif dans ce département." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {department.employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Link href={`/employees/${employee.id}`} className="font-medium hover:text-link hover:underline">
                        {employee.firstName} {employee.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>
                      <StatusBadge status={employee.employmentStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}
