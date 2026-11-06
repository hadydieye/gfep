import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

/** Page introuvable, au design de l'application (04 §4.8, §7) plutôt que la page par défaut. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background-main p-4">
      <section className="flex w-full max-w-md flex-col items-center gap-4 rounded-[8px] border border-border bg-background-surface p-8 text-center shadow-card">
        <FileQuestion className="h-8 w-8 text-foreground-secondary" aria-hidden />
        <h1 className="text-xl font-semibold text-foreground-primary">Page introuvable</h1>
        <p className="text-sm text-foreground-secondary">
          La page demandée n’existe pas ou a été déplacée.
        </p>
        <Link href="/dashboard" className="text-sm font-medium text-link hover:underline">
          Revenir au tableau de bord
        </Link>
      </section>
    </main>
  );
}
