import { redirect } from 'next/navigation';
import { AccountsList } from '@/components/access/accounts-list';
import { getSession, hasRole } from '@/lib/auth/session';

// L'accès est contrôlé par le backend (403 rendu par la liste)
export default async function AccessUsersPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  return <AccountsList isSuperAdmin={hasRole(user, 'SUPER_ADMIN')} />;
}
