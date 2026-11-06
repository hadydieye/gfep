import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { RelatedDocuments } from '@/components/documents/related-documents';
import { EmployeeHistory } from '@/components/employees/employee-history';
import { EmployeeStatusActions } from '@/components/employees/employee-status-actions';
import { StatusBadge, formatDate } from '@/components/employees/status-badge';
import { ApiErrorState } from '@/components/states/states';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api/server';
import type { AuditLogItem, Employee, Paginated, PaginatedDocuments } from '@/lib/api/types';
import { canChangeEmployeeStatus, canWriteEmployee } from '@/lib/auth/scope';
import { getSession, hasPermission } from '@/lib/auth/session';

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), apiGet<Employee>(`/employees/${id}`)]);
  if (!user || (!result.ok && result.status === 401)) {
    redirect('/login');
  }
  if (!result.ok) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Employés', href: '/employees' }, { label: 'Détail' }]} />
        <ApiErrorState status={result.status} message="Impossible de charger cet employé." />
      </>
    );
  }

  const employee = result.data;
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const canWrite = canWriteEmployee(user, employee.departmentId);
  const canChangeStatus = canChangeEmployeeStatus(user, employee);
  // Sections conditionnées par les permissions (N11) ; le serveur applique M9 et 403
  const canReadDocuments = hasPermission(user, 'documents', 'read');
  const canReadAudit = hasPermission(user, 'audit', 'read');
  const [documents, history] = await Promise.all([
    canReadDocuments ? apiGet<PaginatedDocuments>(`/documents?ownerId=${employee.id}&limit=5`) : null,
    canReadAudit
      ? apiGet<Paginated<AuditLogItem>>(`/audit/logs?resourceType=Employee&resourceId=${employee.id}&action=employee.&limit=10`)
      : null,
  ]);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Employés', href: '/employees' }, { label: fullName }]} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground-primary">{fullName}</h1>
          <StatusBadge status={employee.employmentStatus} />
          <span className="text-sm text-foreground-secondary">{employee.employeeNumber}</span>
        </div>
        {(canWrite || canChangeStatus) && (
          <div className="flex gap-2">
            {canWrite && (
              <Button asChild variant="secondary">
                <Link href={`/employees/${employee.id}/edit`}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Modifier
                </Link>
              </Button>
            )}
            {canChangeStatus && <EmployeeStatusActions employee={employee} />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoSection title="Informations personnelles">
          <InfoRow label="Email professionnel">{employee.professionalEmail}</InfoRow>
          <InfoRow label="Téléphone">{employee.phone ?? '—'}</InfoRow>
        </InfoSection>
        <InfoSection title="Informations professionnelles">
          <InfoRow label="Département">
            <Link href={`/departments/${employee.department.id}`} className="text-link hover:underline">
              {employee.department.name}
            </Link>
          </InfoRow>
          <InfoRow label="Poste">{employee.position.title}</InfoRow>
          <InfoRow label="Responsable">
            {employee.manager ? (
              <Link href={`/employees/${employee.manager.id}`} className="text-link hover:underline">
                {employee.manager.firstName} {employee.manager.lastName}
              </Link>
            ) : (
              '—'
            )}
          </InfoRow>
          <InfoRow label="Date d'embauche">{formatDate(employee.hireDate)}</InfoRow>
        </InfoSection>
        {documents && (
          <RelatedDocuments
            title="Documents liés"
            result={documents}
            moreHref={`/documents?ownerId=${employee.id}`}
            emptyMessage="Aucun document visible dont cet employé est propriétaire."
          />
        )}
        {history && <EmployeeHistory result={history} />}
      </div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[8px] border border-border bg-background-surface p-6 shadow-card">
      <h2 className="mb-4 text-base font-semibold text-foreground-primary">{title}</h2>
      <dl className="flex flex-col gap-3">{children}</dl>
    </section>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 text-sm">
      <dt className="text-foreground-secondary">{label}</dt>
      <dd className="text-foreground-primary">{children}</dd>
    </div>
  );
}
