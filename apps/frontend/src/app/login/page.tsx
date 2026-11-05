import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';
import { getSession } from '@/lib/auth/session';

export default async function LoginPage() {
  if (await getSession()) {
    redirect('/dashboard');
  }

  return (
    <AuthCard>
      <LoginForm />
      <div className="mt-6 border-t border-border pt-4 text-center">
        <Link href="/login/ad" className="text-sm font-medium text-link hover:underline">
          Se connecter avec le compte d&apos;entreprise
        </Link>
      </div>
    </AuthCard>
  );
}
