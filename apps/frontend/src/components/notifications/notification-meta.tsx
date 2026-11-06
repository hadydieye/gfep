import { FileText, Info, KeyRound, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NotificationType } from '@/lib/api/types';

// Icône Lucide et libellé par type (design §7.3)
export const NOTIFICATION_META: Record<NotificationType, { icon: LucideIcon; label: string }> = {
  SECURITY: { icon: ShieldAlert, label: 'Sécurité' },
  DOCUMENT_SHARED: { icon: FileText, label: 'Document partagé' },
  ROLE_CHANGED: { icon: KeyRound, label: 'Droits d’accès' },
  WARNING: { icon: TriangleAlert, label: 'Alerte administrative' },
  INFO: { icon: Info, label: 'Information' },
};

/** Événement émis après une action sur les notifications : la topbar recharge son compteur. */
export const NOTIFICATIONS_CHANGED_EVENT = 'gfep:notifications-changed';

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function NotificationIcon({ type, className }: { type: NotificationType; className?: string }) {
  const Icon = NOTIFICATION_META[type].icon;
  return <Icon className={className} aria-hidden />;
}

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export function formatNotificationDate(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}
