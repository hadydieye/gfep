import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement de la fiche employé">
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-6 h-8 w-72" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[8px] border border-border bg-background-surface p-6">
            <Skeleton className="h-5 w-48" />
            {Array.from({ length: 3 }, (_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
