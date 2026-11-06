import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { DepartmentIcon } from '@/components/departments/department-icon';
import { TeamTable } from '@/components/departments/team-table';
import { RelatedDocuments } from '@/components/documents/related-documents';
import { ApiErrorState, EmptyState } from '@/components/states/states';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { apiGet } from '@/lib/api/server';
import type { DepartmentDetail, PaginatedDocuments } from '@/lib/api/types';
import { getSession, hasPermission } from '@/lib/auth/session';

const CARD = 'rounded-[8px] border border-border bg-background-surface p-6 shadow-card';

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), apiGet<DepartmentDetail>(`/departments/${id}`)]);
  if (!user || (!result.ok && result.status === 401)) {
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
  // « Ressources documentaires » (AppFlow §3.5, N11) : département au sens de M8, visibilité M9
  const documents = hasPermission(user, 'documents', 'read')
    ? await apiGet<PaginatedDocuments>(`/documents?departmentId=${department.id}&limit=10`)
    : null;
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
            <TeamTable employees={department.employees} />
          )}
        </section>
        {documents && (
          <div className="lg:col-span-2">
            <RelatedDocuments
              title="Ressources documentaires"
              result={documents}
              moreHref={`/documents?departmentId=${department.id}`}
              emptyMessage="Aucun document visible pour ce département."
            />
          </div>
        )}
      </div>
    </div>
  );
}
