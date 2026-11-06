import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { ROLE_LABELS } from '@/components/access/access-labels';
import { ApiErrorState } from '@/components/states/states';
import { apiGet } from '@/lib/api/server';
import type { RoleSummary } from '@/lib/api/types';

export default async function AccessRolesPage() {
  const result = await apiGet<RoleSummary[]>('/access/roles');
  if (!result.ok && result.status === 401) redirect('/login');
  if (!result.ok) return <ApiErrorState status={result.status} message="Impossible de charger les rôles." />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-foreground-primary">Rôles</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {result.data.map((role) => (
          <Link
            key={role.id}
            href={`/access/roles/${role.id}`}
            className="flex flex-col gap-2 rounded-[8px] border border-border bg-background-surface p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors hover:border-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold text-foreground-primary">
                <ShieldCheck className="h-4 w-4 text-foreground-secondary" aria-hidden />
                {ROLE_LABELS[role.name] ?? role.name}
              </span>
              <ChevronRight className="h-4 w-4 text-foreground-secondary" aria-hidden />
            </span>
            <span className="text-sm text-foreground-secondary">{role.description}</span>
            <span className="mt-auto text-sm tabular-nums text-foreground-primary">
              {role.userCount} compte{role.userCount === 1 ? '' : 's'} · {role.permissionCount} permission{role.permissionCount === 1 ? '' : 's'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
