import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Identifiant pour associer label et input (généralement fourni automatiquement) */
  fieldId?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, fieldId, id, ...props }, ref) => {
    // useId must be called unconditionally to respect the Rules of Hooks.
    const generatedId = React.useId();
    const resolvedId = fieldId ?? id ?? generatedId;

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
        <input
          id={resolvedId}
          ref={ref}
          className={cn(
            'flex h-9 w-full rounded-md border bg-background-surface px-3 py-1 text-sm',
            'border-foreground-secondary text-foreground-primary placeholder:text-foreground-secondary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-background-surface-dark dark:border-foreground-secondary-dark',
            'dark:text-foreground-primary-dark dark:placeholder:text-foreground-secondary-dark',
            error && 'border-error focus-visible:ring-error',
            className,
          )}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${resolvedId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${resolvedId}-error`}
            role="alert"
            className="text-xs text-error dark:text-error-dark"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
