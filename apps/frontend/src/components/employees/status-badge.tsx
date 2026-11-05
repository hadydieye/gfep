import { Badge } from '@/components/ui/badge';
import type { EmploymentStatus } from '@/lib/api/types';

export const STATUS_LABELS: Record<EmploymentStatus, string> = {
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  TERMINATED: 'Sorti',
};

const STATUS_VARIANTS = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  TERMINATED: 'error',
} as const satisfies Record<EmploymentStatus, string>;

export function StatusBadge({ status }: { status: EmploymentStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
}
