import { redirect } from 'next/navigation';
import { AdMappingsManager } from '@/components/access/ad-mappings-manager';
import { getSession, hasRole } from '@/lib/auth/session';

// Mappings groupe AD → rôle (M22) : IT_ADMINISTRATOR et SUPER_ADMIN ; le backend fait foi (403 sinon)
export default async function AdMappingsPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  return <AdMappingsManager isSuperAdmin={hasRole(user, 'SUPER_ADMIN')} />;
}
