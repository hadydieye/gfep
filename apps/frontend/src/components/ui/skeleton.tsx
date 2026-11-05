import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-border/60 dark:bg-border-dark/60', className)}
      {...props}
    />
  );
}

export { Skeleton };
