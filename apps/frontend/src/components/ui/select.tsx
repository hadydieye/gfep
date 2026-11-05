import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

// Sélecteur natif aligné sur le style de <Input> (label au-dessus, erreur en dessous)
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const generatedId = React.useId();
    const resolvedId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={resolvedId}
            className="text-sm font-medium text-foreground-primary dark:text-foreground-primary-dark"
          >
            {label}
          </label>
        )}
        <select
          id={resolvedId}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-md border bg-background-surface px-3 py-1 text-sm',
            'border-foreground-secondary text-foreground-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-background-surface-dark dark:border-foreground-secondary-dark dark:text-foreground-primary-dark',
            error && 'border-error focus-visible:ring-error',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${resolvedId}-error` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${resolvedId}-error`} role="alert" className="text-xs text-error dark:text-error-dark">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

export { Select };
