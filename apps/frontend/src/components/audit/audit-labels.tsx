import { Badge } from '@/components/ui/badge';
import type { AuthEventType, SecuritySeverity } from '@/lib/api/types';

// Actions journalisées (R26.1), en français
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'employee.create': 'Création d’employé',
  'employee.update': 'Modification d’employé',
  'employee.status_change': 'Changement de statut d’employé',
  'role.assign': 'Attribution de rôle',
  'role.remove': 'Retrait de rôle',
  'role.permissions_update': 'Modification des permissions d’un rôle',
  'user.suspend': 'Suspension de compte',
  'user.reactivate': 'Réactivation de compte',
  'user.unlock': 'Déverrouillage de compte',
  'document.view': 'Consultation de document',
  'document.download': 'Téléchargement de document',
  'document.delete': 'Suppression de document',
  'document.validate': 'Validation de document',
  'document.share': 'Partage de document',
  'transaction.create': 'Création de transaction',
  'transaction.status_change': 'Décision sur une transaction',
  'invoice.status_change': 'Changement de statut de facture',
  'ad_mapping.create': 'Création d’un mapping AD',
  'ad_mapping.delete': 'Suppression d’un mapping AD',
};

export const SECURITY_EVENT_LABELS: Record<string, string> = {
  account_locked: 'Compte verrouillé',
  repeated_forbidden: 'Refus d’accès répétés',
  ad_unreachable: 'Annuaire injoignable',
};

export const AUTH_EVENT_LABELS: Record<AuthEventType, string> = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILED: 'Échec de connexion',
  LOGOUT: 'Déconnexion',
  ACCOUNT_LOCKED: 'Verrouillage',
  AD_BIND_FAILED: 'Mot de passe d’annuaire refusé',
  AD_UNREACHABLE: 'Annuaire injoignable',
  AD_SERVICE_BIND_FAILED: 'Compte de service refusé',
  AD_USER_NOT_FOUND: 'Utilisateur d’annuaire introuvable',
  AD_NO_EMPLOYEE_MATCH: 'Aucune fiche employé',
  AD_NO_ROLE_MAPPING: 'Aucun groupe mappé',
  AD_LOCAL_ACCOUNT_CONFLICT: 'Conflit avec un compte local',
};

const SEVERITY: Record<SecuritySeverity, { label: string; variant: 'neutral' | 'warning' | 'error' }> = {
  LOW: { label: 'Faible', variant: 'neutral' },
  MEDIUM: { label: 'Moyenne', variant: 'warning' },
  HIGH: { label: 'Élevée', variant: 'error' },
  CRITICAL: { label: 'Critique', variant: 'error' },
};

export const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  LOW: SEVERITY.LOW.label,
  MEDIUM: SEVERITY.MEDIUM.label,
  HIGH: SEVERITY.HIGH.label,
  CRITICAL: SEVERITY.CRITICAL.label,
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function securityEventLabel(eventType: string): string {
  return SECURITY_EVENT_LABELS[eventType] ?? eventType;
}

export function SeverityBadge({ severity }: { severity: SecuritySeverity }) {
  const badge = SEVERITY[severity];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

export function formatAuditDate(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}
