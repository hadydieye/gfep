import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { apiGet } from '@/lib/api/server';
import { getSession } from '@/lib/auth/session';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  // Valeur initiale du badge ; la topbar la recharge ensuite côté client
  const unread = await apiGet<{ count: number }>('/notifications/unread-count');

  return (
    <AppShell user={user} initialUnreadCount={unread.ok ? unread.data.count : 0}>
      {children}
    </AppShell>
  );
}
