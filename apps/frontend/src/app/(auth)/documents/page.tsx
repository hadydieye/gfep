import { DocumentsList } from '@/components/documents/documents-list';
import { apiGet } from '@/lib/api/server';
import type { Department, Employee } from '@/lib/api/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/documents?ownerId=` (fiche employé) et `/documents?departmentId=` (détail de
 * département) arrivent avec un filtre actif, nommé et retirable (N11). Un
 * identifiant invalide ou introuvable est ignoré : la liste complète s'affiche.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ownerId =
    typeof params.ownerId === 'string' && UUID.test(params.ownerId) ? params.ownerId : null;
  const departmentId =
    typeof params.departmentId === 'string' && UUID.test(params.departmentId)
      ? params.departmentId
      : null;

  let scope: { param: 'ownerId' | 'departmentId'; id: string; label: string } | null = null;
  if (ownerId) {
    const employee = await apiGet<Employee>(`/employees/${ownerId}`);
    if (employee.ok) {
      scope = {
        param: 'ownerId',
        id: ownerId,
        label: `Propriétaire : ${employee.data.firstName} ${employee.data.lastName}`,
      };
    }
  } else if (departmentId) {
    const department = await apiGet<Department>(`/departments/${departmentId}`);
    if (department.ok)
      scope = {
        param: 'departmentId',
        id: departmentId,
        label: `Département : ${department.data.name}`,
      };
  }

  return <DocumentsList scope={scope} />;
}
