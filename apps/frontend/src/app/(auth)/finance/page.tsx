import { redirect } from 'next/navigation';

/** `/finance` n'est pas un écran (AppFlow §2) : redirection vers la liste des transactions (N12). */
export default function FinancePage() {
  redirect('/finance/transactions');
}
