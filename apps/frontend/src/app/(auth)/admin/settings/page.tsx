import { redirect } from 'next/navigation';
import { SessionSettingsForm } from '@/components/settings/session-settings-form';
import { ApiErrorState } from '@/components/states/states';
import { apiGet } from '@/lib/api/server';
import type { EffectiveConfiguration } from '@/lib/api/types';
import { getSession } from '@/lib/auth/session';

/**
 * Page /admin/settings (T3.2.9, N16) : durée de session modifiable,
 * configuration effective en lecture seule.
 */
export default async function SettingsPage() {
  const [user, result] = await Promise.all([getSession(), apiGet<EffectiveConfiguration>('/admin/settings')]);
  if (!user || (!result.ok && result.status === 401)) {
    redirect('/login');
  }
  if (!result.ok) {
    return <ApiErrorState status={result.status} message="Impossible de charger les paramètres." />;
  }

  const config = result.data;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold text-foreground-primary">Paramètres système</h1>
      <div className="space-y-6">
        {/* Carte : Session */}
        <div className="rounded-lg border border-border bg-background-surface p-6 shadow-card">
          <h2 className="mb-1 text-lg font-semibold text-foreground-primary">Session</h2>
          <p className="mb-4 text-sm text-foreground-secondary">
            Durée de validité des nouvelles sessions. Les sessions en cours ne sont pas affectées.
          </p>
          <SessionSettingsForm initialHours={config.sessionTtlHours} />
        </div>

        {/* Carte : Configuration effective */}
        <div className="rounded-lg border border-border bg-background-surface p-6 shadow-card">
          <h2 className="mb-4 text-lg font-semibold text-foreground-primary">Configuration effective</h2>
          <dl className="space-y-3">
            <ConfigRow label="Verrouillage" value={`${config.maxFailedLogins} échecs, verrou de ${config.lockDurationMs / 60000} min`} />
            <ConfigRow label="Limite connexion (par IP)" value={`${config.loginRateLimit.limit} tentatives / ${config.loginRateLimit.windowMs / 60000} min`} />
            <ConfigRow label="Limite changement de mot de passe" value={`${config.passwordChangeRateLimit.limit} tentatives / ${config.passwordChangeRateLimit.windowMs / 60000} min`} />
            <ConfigRow label="Taille max document" value={`${config.maxUploadBytes / (1024 * 1024)} Mo`} />
            <ConfigRow label="Formats acceptés" value={config.allowedMimeTypes.map(mimeLabel).join(', ')} />
            <ConfigRow label="État de l'annuaire" value={adStatusLabel(config.adStatus)} />
            <ConfigRow label="Version de l'application" value={config.appVersion} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-foreground-secondary">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground-primary">{value}</dd>
    </div>
  );
}

function mimeLabel(mime: string): string {
  const MAP: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  };
  return MAP[mime] ?? mime;
}

function adStatusLabel(status: string): string {
  if (status === 'UP') return 'Disponible';
  if (status === 'DOWN') return 'Indisponible';
  return 'Non configuré';
}
