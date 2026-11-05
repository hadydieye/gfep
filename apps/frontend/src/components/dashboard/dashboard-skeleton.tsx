import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement du tableau de bord">
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-[8px] border border-border bg-background-surface p-6"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
