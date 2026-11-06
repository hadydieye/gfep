import { redirect } from 'next/navigation';
import { EmployeesList } from '@/components/employees/employees-list';
import { getSession, hasPermission } from '@/lib/auth/session';

export default async function EmployeesPage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  return <EmployeesList canCreate={hasPermission(user, 'employees', 'write')} />;
}
