import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DepartmentIcon } from '@/components/departments/department-icon';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { apiGet } from '@/lib/api/server';
import type { Department } from '@/lib/api/types';

export default async function DepartmentsPage() {
  const result = await apiGet<Department[]>('/departments');
  if (!result.ok && result.status === 401) {
    redirect('/login');
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground-primary">Départements</h1>
      {!result.ok ? (
        <ApiErrorState status={result.status} message="Impossible de charger les départements." />
      ) : result.data.length === 0 ? (
        <EmptyState message="Aucun département." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.data.map((department) => (
            <Link
              key={department.id}
              href={`/departments/${department.id}`}
              className="group flex flex-col gap-4 rounded-[8px] border border-border bg-background-surface p-6 shadow-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-foreground-primary group-hover:text-link">
                    {department.name}
                  </h2>
                  <p className="text-xs font-medium text-foreground-secondary">{department.code}</p>
                </div>
                <span className="rounded-md bg-primary/10 p-2 text-link">
                  <DepartmentIcon code={department.code} className="h-5 w-5" />
                </span>
              </div>
              <div>
                <p className="text-[32px] font-semibold leading-tight text-foreground-primary">
                  {department.headcount}
                </p>
                <p className="text-sm text-foreground-secondary">
                  employé{department.headcount > 1 ? 's' : ''} actif{department.headcount > 1 ? 's' : ''}
                </p>
              </div>
              <p className="border-t border-border pt-3 text-sm text-foreground-secondary">
                Responsable :{' '}
                <span className="font-medium text-foreground-primary">
                  {department.manager
                    ? `${department.manager.firstName} ${department.manager.lastName}`
                    : 'Non désigné'}
                </span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
