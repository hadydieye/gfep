import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Contraste AA : les couleurs sémantiques n'atteignent pas 4.5:1 en texte de
// 12px sur leur propre teinte (ex. warning 2.8:1). La sémantique est portée par
// le fond teinté et la pastille ; le texte reste en couleur de premier plan.
const badgeVariants = cva(
  // Forme pilule + texte court
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors text-foreground-primary dark:text-foreground-primary-dark',
  {
    variants: {
      variant: {
        success: 'bg-success/15 dark:bg-success-dark/20',
        warning: 'bg-warning/20 dark:bg-warning-dark/20',
        error: 'bg-error/15 dark:bg-error-dark/20',
        neutral: 'bg-border/60 dark:bg-border-dark/60',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

const dotVariants = cva('h-1.5 w-1.5 shrink-0 rounded-full', {
  variants: {
    variant: {
      success: 'bg-success dark:bg-success-dark',
      warning: 'bg-warning dark:bg-warning-dark',
      error: 'bg-error dark:bg-error-dark',
      neutral: 'bg-foreground-secondary dark:bg-foreground-secondary-dark',
    },
  },
  defaultVariants: {
    variant: 'neutral',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      <span aria-hidden className={dotVariants({ variant })} />
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
