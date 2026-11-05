import * as React from 'react';

// Carte centrée partagée par /login et /login/ad
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main px-4">
      <div className="w-full max-w-sm rounded-[8px] border border-border bg-background-surface p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="mb-6 text-center">
          <p className="text-xl font-semibold tracking-wide text-link">GUINEA FINANCE</p>
          <p className="mt-1 text-sm text-foreground-secondary">Portail de gestion interne</p>
        </div>
        {children}
      </div>
    </main>
  );
}
