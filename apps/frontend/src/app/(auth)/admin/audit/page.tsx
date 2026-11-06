import { redirect } from 'next/navigation';
import { AuditConsole } from '@/components/audit/audit-console';
import { getSession, hasPermission } from '@/lib/auth/session';

// L'accès est contrôlé par le backend (403 rendu par chaque onglet pour les autres rôles, dont l'ITA, M21)
export default async function AuditPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  return <AuditConsole canReadSecurityEvents={hasPermission(user, 'security_events', 'read')} />;
}
