import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

/**
 * /admin redirige vers /admin/audit si l'utilisateur a audit:read,
 * sinon vers /admin/settings (T3.2.9, N16).
 */
export default async function AdminPage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  const canReadAudit = user.permissions.some((p) => p.resource === 'audit' && p.action === 'read');
  redirect(canReadAudit ? '/admin/audit' : '/admin/settings');
}
