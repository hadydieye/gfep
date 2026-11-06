import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm, adLoginErrorMessage } from '@/components/auth/login-form';
import { getSession } from '@/lib/auth/session';

// Connexion avec le compte d'entreprise (AppFlow §3.2, R33) : identifiant et mot de passe de l'annuaire
export default async function ActiveDirectoryLoginPage() {
  if (await getSession()) {
    redirect('/dashboard');
  }

  return (
    <AuthCard>
      <p className="mb-4 text-center text-sm text-foreground-secondary">Compte d&apos;entreprise</p>
      <LoginForm endpoint="/auth/login-ad" errorMessage={adLoginErrorMessage} />
      <div className="mt-6 border-t border-border pt-4 text-center">
        <Link href="/login" className="text-sm font-medium text-link hover:underline">
          Retour à la connexion locale
        </Link>
      </div>
    </AuthCard>
  );
}
