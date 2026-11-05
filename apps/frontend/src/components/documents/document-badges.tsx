import { Badge } from '@/components/ui/badge';
import type { ConfidentialityLevel, DocumentValidationStatus } from '@/lib/api/types';

const CONFIDENTIALITY: Record<ConfidentialityLevel, { label: string; variant: 'success' | 'neutral' | 'warning' | 'error' }> = {
  PUBLIC: { label: 'Public', variant: 'success' },
  INTERNAL: { label: 'Interne', variant: 'neutral' },
  CONFIDENTIAL: { label: 'Confidentiel', variant: 'warning' },
  RESTRICTED: { label: 'Restreint', variant: 'error' },
};

const VALIDATION: Record<DocumentValidationStatus, { label: string; variant: 'success' | 'warning' | 'error' }> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  VALIDATED: { label: 'Validé', variant: 'success' },
  REJECTED: { label: 'Rejeté', variant: 'error' },
};

export function ConfidentialityBadge({ level }: { level: ConfidentialityLevel }) {
  const badge = CONFIDENTIALITY[level];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

export function ValidationBadge({ status }: { status: DocumentValidationStatus }) {
  const badge = VALIDATION[status];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}