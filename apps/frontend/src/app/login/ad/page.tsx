import Link from 'next/link';
import { Info } from 'lucide-react';
import { AuthCard } from '@/components/auth/auth-card';
import { Button } from '@/components/ui/button';

export default function ActiveDirectoryLoginPage() {
  return (
    <AuthCard>
      <div className="flex flex-col items-center gap-4 text-center">
        <Info className="h-6 w-6 text-foreground-secondary" aria-hidden />
        <p className="text-sm text-foreground-primary">
          L&apos;authentification par compte d&apos;entreprise n&apos;est pas disponible pour le
          moment. Utilisez votre compte local ou contactez l&apos;administrateur.
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/login">Retour à la connexion locale</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
