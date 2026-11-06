import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Libellé toujours visible (design §10) */
  label: React.ReactNode;
  description?: React.ReactNode;
}

// Case à cocher native aux couleurs GFEP : focus visible, état désactivé lisible
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const resolvedId = id ?? generatedId;
    return (
      <div className={cn('flex items-start gap-2', className)}>
        <input
          id={resolvedId}
          ref={ref}
          type="checkbox"
          disabled={disabled}
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-foreground-secondary accent-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:border-foreground-secondary-dark dark:accent-primary-dark',
          )}
          aria-describedby={description ? `${resolvedId}-description` : undefined}
          {...props}
        />
        <label
          htmlFor={resolvedId}
          className={cn(
            'text-sm text-foreground-primary dark:text-foreground-primary-dark',
            disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
          )}
        >
          {label}
          {description && (
            <span id={`${resolvedId}-description`} className="block text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
              {description}
            </span>
          )}
        </label>
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
