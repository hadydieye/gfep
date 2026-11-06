import { redirect } from 'next/navigation';

// `/admin` redirige vers la consultation des journaux (R28.2)
export default function AdminPage() {
  redirect('/admin/audit');
}
