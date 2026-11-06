import { redirect } from 'next/navigation';

// `/access` redirige vers la gestion des comptes (R20.1)
export default function AccessPage() {
  redirect('/access/users');
}
