import { Skeleton } from '@/components/ui/skeleton';

export default function DepartmentsLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement des départements">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-[8px] border border-border bg-background-surface p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
