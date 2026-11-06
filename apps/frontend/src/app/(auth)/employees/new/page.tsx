import { redirect } from 'next/navigation';
import { EmployeeForm } from '@/components/employees/employee-form';
import { ApiErrorState } from '@/components/states/states';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { writeScopeDepartmentId } from '@/lib/auth/scope';
import { getSession, hasPermission } from '@/lib/auth/session';

export default async function NewEmployeePage() {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Employés', href: '/employees' }, { label: 'Nouvel employé' }]} />
      <h1 className="mb-6 text-2xl font-semibold text-foreground-primary">Nouvel employé</h1>
      {hasPermission(user, 'employees', 'write') ? (
        <EmployeeForm scopeDepartmentId={writeScopeDepartmentId(user)} />
      ) : (
        <ApiErrorState status={403} />
      )}
    </div>
  );
}
