import { redirect } from 'next/navigation';
import { TransactionsList } from '@/components/finance/transactions-list';
import { getSession, hasPermission } from '@/lib/auth/session';

// L'accès est contrôlé par le backend (403 rendu par la liste) ; les permissions ne servent qu'à l'affichage
export default async function TransactionsPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  return (
    <TransactionsList
      canCreate={hasPermission(user, 'transactions', 'write')}
      canValidate={hasPermission(user, 'transactions', 'validate')}
    />
  );
}
