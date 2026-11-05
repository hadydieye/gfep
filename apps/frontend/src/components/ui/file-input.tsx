'use client';

import * as React from 'react';
import { FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  selectedName?: string;
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, label, error, selectedName, id, ...props }, ref) => {
    const generatedId = React.useId();
    const resolvedId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={resolvedId} className="text-sm font-medium text-foreground-primary">
          {label}
        </label>
        <label
          htmlFor={resolvedId}
          className={cn(
            'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-foreground-secondary bg-background-surface px-3 py-2 text-sm text-foreground-primary hover:bg-background-main',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-link',
            error && 'border-error',
            className,
          )}
        >
          <FileUp className="h-4 w-4 shrink-0 text-foreground-secondary" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{selectedName ?? 'Choisir un fichier'}</span>
          <input
            {...props}
            ref={ref}
            id={resolvedId}
            type="file"
            className="sr-only"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? `${resolvedId}-error` : undefined}
          />
        </label>
        {error && <p id={`${resolvedId}-error`} role="alert" className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);
FileInput.displayName = 'FileInput';