import { Skeleton } from '@/components/ui/skeleton';

const CARD = 'flex flex-col gap-3 rounded-[8px] border border-border bg-background-surface p-6';

/** Squelette d'un écran de détail : fil d'Ariane, titre, deux panneaux (04 §4.8). */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-6 h-8 w-72" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className={CARD}>
            <Skeleton className="h-5 w-48" />
            {Array.from({ length: 4 }, (_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Squelette d'une grille de cartes (ex. liste des rôles). */
export function CardGridSkeleton({ label, count = 8 }: { label: string; count?: number }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={CARD}>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Squelette d'un formulaire sur sa propre page (04 §4.5). */
export function FormSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-6 h-8 w-64" />
      <div className={CARD}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
