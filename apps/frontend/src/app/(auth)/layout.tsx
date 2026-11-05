import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { getSession } from '@/lib/auth/session';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background-main">
      <Sidebar user={user} />
      <div className="md:pl-[260px]">
        <Topbar user={user} />
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
