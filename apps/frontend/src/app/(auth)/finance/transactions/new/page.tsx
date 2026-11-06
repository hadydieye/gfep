import { redirect } from 'next/navigation';
import { ApiErrorState } from '@/components/states/states';
import { TransactionForm } from '@/components/finance/transaction-form';
import { getSession, hasPermission } from '@/lib/auth/session';

export default async function NewTransactionPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!hasPermission(user, 'transactions', 'write')) return <ApiErrorState status={403} />;
  return <TransactionForm />;
}
