import { Skeleton } from '@/components/ui/skeleton';

export default function DocumentsLoading() {
  return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-10 w-full" /><Skeleton className="h-72 w-full" /></div>;
}