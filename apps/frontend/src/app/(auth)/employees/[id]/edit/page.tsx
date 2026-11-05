import { redirect } from 'next/navigation';
import { EmployeeForm } from '@/components/employees/employee-form';
import { ApiErrorState } from '@/components/states/states';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { apiGet } from '@/lib/api/server';
import type { Employee } from '@/lib/api/types';
import { canWriteEmployee, writeScopeDepartmentId } from '@/lib/auth/scope';
import { getSession } from '@/lib/auth/session';

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, result] = await Promise.all([getSession(), apiGet<Employee>(`/employees/${id}`)]);
  if (!user || (!result.ok && result.status === 401)) {
    redirect('/login');
  }
  if (!result.ok) {
    return <ApiErrorState status={result.status} message="Impossible de charger cet employé." />;
  }

  const employee = result.data;
  const fullName = `${employee.firstName} ${employee.lastName}`;
  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Employés', href: '/employees' },
          { label: fullName, href: `/employees/${employee.id}` },
          { label: 'Modifier' },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold text-foreground-primary">Modifier {fullName}</h1>
      {canWriteEmployee(user, employee.departmentId) ? (
        <EmployeeForm employee={employee} scopeDepartmentId={writeScopeDepartmentId(user)} />
      ) : (
        <ApiErrorState status={403} />
      )}
    </div>
  );
}
