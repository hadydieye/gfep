import { Activity, Database, Network } from 'lucide-react';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { Badge } from '@/components/ui/badge';
import type { DashboardData } from '@/lib/api/types';

type Services = NonNullable<DashboardData['services']>;

const DATABASE = {
  UP: { label: 'Opérationnelle', variant: 'success' },
  DOWN: { label: 'Indisponible', variant: 'error' },
} as const;

/** État des services (M20) : base de données ; LDAP « Non configuré » jusqu'à l'étape 2.7. */
export function ServiceStatusCard({ services }: { services: Services }) {
  const database = DATABASE[services.database];
  return (
    <DashboardCard label="État des services" icon={Activity}>
      <ul className="flex flex-col gap-3 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-foreground-primary">
            <Database className="h-4 w-4 text-foreground-secondary" aria-hidden />
            Base de données
          </span>
          <Badge variant={database.variant}>{database.label}</Badge>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-foreground-primary">
            <Network className="h-4 w-4 text-foreground-secondary" aria-hidden />
            Annuaire LDAP
          </span>
          <Badge variant="neutral">Non configuré</Badge>
        </li>
      </ul>
    </DashboardCard>
  );
}
