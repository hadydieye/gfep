import { Skeleton } from '@/components/ui/skeleton';

export default function DepartmentDetailLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement du département">
      <Skeleton className="mb-4 h-4 w-48" />
      <Skeleton className="mb-6 h-10 w-72" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-3 rounded-[8px] border border-border bg-background-surface p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-col gap-3 rounded-[8px] border border-border bg-background-surface p-6">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
