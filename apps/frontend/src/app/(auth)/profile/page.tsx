import { redirect } from 'next/navigation';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ChangePasswordForm } from '@/components/profile/change-password-form';
import { ApiErrorState } from '@/components/states/states';
import { formatDate } from '@/components/employees/status-badge';
import { apiGet } from '@/lib/api/server';
import type { ProfileData } from '@/lib/api/types';
import { getSession } from '@/lib/auth/session';

/**
 * Page /profile (T3.2.8, N15) : informations du compte connecté,
 * changement de mot de passe (LOCAL uniquement), bascule de thème.
 */
export default async function ProfilePage() {
  const [user, result] = await Promise.all([getSession(), apiGet<ProfileData>('/profile')]);
  if (!user || (!result.ok && result.status === 401)) {
    redirect('/login');
  }
  if (!result.ok) {
    return <ApiErrorState status={result.status} message="Impossible de charger votre profil." />;
  }

  const { account, employee } = result.data;
  const isLocal = account.authProvider === 'LOCAL';

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-foreground-primary">Mon profil</h1>
      <div className="space-y-6">
        {/* Carte : Mes informations */}
        <div className="rounded-lg border border-border bg-background-surface p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-foreground-primary">Mes informations</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-foreground-secondary">Identifiant</dt>
              <dd className="mt-0.5 text-sm text-foreground-primary">{account.username}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground-secondary">Email</dt>
              <dd className="mt-0.5 text-sm text-foreground-primary">{account.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground-secondary">Type de compte</dt>
              <dd className="mt-0.5 text-sm text-foreground-primary">
                {account.authProvider === 'LOCAL' ? 'Compte local' : "Compte d'entreprise (Active Directory)"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground-secondary">Rôles</dt>
              <dd className="mt-0.5 text-sm text-foreground-primary">{account.roles.join(', ')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground-secondary">Dernière connexion</dt>
              <dd className="mt-0.5 text-sm text-foreground-primary">
                {account.lastLoginAt ? formatDate(account.lastLoginAt) : 'Jamais'}
              </dd>
            </div>
            {employee && (
              <>
                <div>
                  <dt className="text-sm font-medium text-foreground-secondary">Nom complet</dt>
                  <dd className="mt-0.5 text-sm text-foreground-primary">
                    {employee.firstName} {employee.lastName}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-foreground-secondary">Matricule</dt>
                  <dd className="mt-0.5 text-sm text-foreground-primary">{employee.employeeNumber}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-foreground-secondary">Département</dt>
                  <dd className="mt-0.5 text-sm text-foreground-primary">{employee.department.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-foreground-secondary">Poste</dt>
                  <dd className="mt-0.5 text-sm text-foreground-primary">{employee.position}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {/* Carte : Mot de passe (LOCAL uniquement) */}
        {isLocal && (
          <div className="rounded-lg border border-border bg-background-surface p-6 shadow-card">
            <h2 className="mb-4 text-lg font-semibold text-foreground-primary">Mot de passe</h2>
            <ChangePasswordForm />
          </div>
        )}

        {/* Carte : Apparence */}
        <div className="rounded-lg border border-border bg-background-surface p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-foreground-primary">Apparence</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground-secondary">Thème</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
