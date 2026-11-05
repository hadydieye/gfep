import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Building2,
  FileClock,
  FileText,
  IdCard,
  LineChart,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { ErrorState } from '@/components/states/states';
import { apiGet } from '@/lib/api/server';
import type { AuthUser, DashboardData } from '@/lib/api/types';
import { getSession } from '@/lib/auth/session';

const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3';

export default async function DashboardPage() {
  const [user, result] = await Promise.all([getSession(), apiGet<DashboardData>('/dashboard')]);
  if (!user || (!result.ok && result.status === 401)) {
    redirect('/login');
  }
  if (!result.ok) {
    return <ErrorState message="Impossible de charger le tableau de bord. Réessayer." />;
  }

  const firstName = user.employee?.firstName ?? user.username;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground-primary">Bonjour, {firstName}</h1>
      <div className={GRID}>
        {result.data.role === 'SUPER_ADMIN' && <AdminCards data={result.data} />}
        {result.data.role === 'DEPARTMENT_MANAGER' && <ManagerCards data={result.data} />}
        {result.data.role === 'EMPLOYEE' && <EmployeeCards user={user} data={result.data} />}
      </div>
    </div>
  );
}

function AdminCards({ data }: { data: DashboardData }) {
  return (
    <>
      <DashboardCard
        label="Effectif global"
        icon={Users}
        value={data.indicators.totalEmployees ?? 0}
        subtitle="Employés actifs"
      />
      <DashboardCard label="Accès rapides" icon={Zap}>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <Link href="/employees" className="inline-flex items-center gap-2 text-link hover:underline">
              <Users className="h-4 w-4" aria-hidden /> Employés
            </Link>
          </li>
          <li>
            <Link href="/departments" className="inline-flex items-center gap-2 text-link hover:underline">
              <Building2 className="h-4 w-4" aria-hidden /> Départements
            </Link>
          </li>
        </ul>
      </DashboardCard>
    </>
  );
}

function ManagerCards({ data }: { data: DashboardData }) {
  return (
    <>
      <DashboardCard
        label="Effectif de mon équipe"
        icon={Users}
        value={data.indicators.departmentEmployees ?? 0}
        subtitle="Employés actifs du département"
      />
      <DashboardCard
        label="Département"
        icon={LineChart}
        value={<span className="text-xl">{data.indicators.departmentName ?? '—'}</span>}
        subtitle="Votre périmètre de gestion"
      />
      <DocumentListCard
        label="Documents en attente de validation"
        icon={FileClock}
        documents={data.pendingDocuments ?? []}
        emptyMessage="Aucun document en attente de validation."
      />
    </>
  );
}

function EmployeeCards({ user, data }: { user: AuthUser; data: DashboardData }) {
  return (
    <>
      <DashboardCard label="Mes informations" icon={IdCard}>
        <dl className="flex flex-col gap-1 text-sm">
          {user.employee && (
            <div>
              <dt className="sr-only">Nom</dt>
              <dd className="font-medium text-foreground-primary">
                {user.employee.firstName} {user.employee.lastName}
              </dd>
            </div>
          )}
          <div>
            <dt className="sr-only">Email</dt>
            <dd className="text-foreground-secondary">{user.email}</dd>
          </div>
        </dl>
        {user.employee && (
          <Link
            href={`/employees/${user.employee.id}`}
            className="mt-1 text-sm font-medium text-link hover:underline"
          >
            Voir ma fiche
          </Link>
        )}
      </DashboardCard>
      <DocumentListCard
        label="Mes documents récents"
        icon={FileText}
        documents={data.recentDocuments ?? []}
        emptyMessage="Aucun document récent."
      />
    </>
  );
}

function DocumentListCard({
  label,
  icon,
  documents,
  emptyMessage,
}: {
  label: string;
  icon: LucideIcon;
  documents: Array<{ id: string; title: string; createdAt: string }>;
  emptyMessage: string;
}) {
  return (
    <DashboardCard label={label} icon={icon}>
      {documents.length === 0 ? (
        <p className="text-sm text-foreground-secondary">{emptyMessage}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {documents.map((document) => (
            <li key={document.id} className="flex items-baseline justify-between gap-3">
              <Link
                href={`/documents/${document.id}`}
                className="min-w-0 truncate font-medium text-link hover:underline"
              >
                {document.title}
              </Link>
              <time className="shrink-0 text-xs text-foreground-secondary" dateTime={document.createdAt}>
                {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                  new Date(document.createdAt),
                )}
              </time>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
