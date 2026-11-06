import { redirect } from 'next/navigation';
import { RolePermissionsEditor } from '@/components/access/role-permissions-editor';
import { ApiErrorState } from '@/components/states/states';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { apiGet } from '@/lib/api/server';
import type { RoleDetail } from '@/lib/api/types';

export default async function AccessRoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<RoleDetail>(`/access/roles/${id}`);
  if (!result.ok && result.status === 401) redirect('/login');
  if (!result.ok) {
    return (
      <>
        <Breadcrumb items={[{ label: 'Rôles', href: '/access/roles' }, { label: 'Détail' }]} />
        <ApiErrorState status={result.status} message="Impossible de charger ce rôle." />
      </>
    );
  }
  return <RolePermissionsEditor role={result.data} />;
}
