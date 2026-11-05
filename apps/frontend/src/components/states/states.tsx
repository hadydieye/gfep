'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, FileQuestion, Inbox, Lock, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

function StateBox({
  icon: Icon,
  message,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-border bg-background-surface px-6 py-12 text-center">
      <Icon className="h-8 w-8 text-foreground-secondary" />
      <p className="text-sm text-foreground-primary">{message}</p>
      {children}
    </div>
  );
}

export function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <StateBox icon={Inbox} message={message}>
      {children}
    </StateBox>
  );
}

/** Erreur avec bouton « Réessayer » ; sans onRetry, rafraîchit les Server Components. */
export function ErrorState({
  message = 'Impossible de charger les données.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const router = useRouter();
  return (
    <StateBox icon={AlertTriangle} message={message}>
      <Button variant="secondary" onClick={onRetry ?? (() => router.refresh())}>
        <RotateCw className="h-4 w-4" aria-hidden />
        Réessayer
      </Button>
    </StateBox>
  );
}

/** Rendu d'un échec d'appel API : 403 et 404 sont distingués de l'erreur générique. */
export function ApiErrorState({
  status,
  message,
  onRetry,
}: {
  status: number;
  message?: string;
  onRetry?: () => void;
}) {
  if (status === 403) {
    return <StateBox icon={Lock} message="Vous n'avez pas accès à cette section." />;
  }
  if (status === 404) {
    return <StateBox icon={FileQuestion} message="Cette ressource n'existe pas ou a été supprimée." />;
  }
  return <ErrorState message={message} onRetry={onRetry} />;
}
