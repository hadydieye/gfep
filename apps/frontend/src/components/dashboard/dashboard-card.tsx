import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DashboardCardProps {
  label: string;
  value?: React.ReactNode;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
  className?: string;
}

export function DashboardCard({ label, value, subtitle, icon: Icon, children, className }: DashboardCardProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-[8px] border border-border bg-background-surface p-6 shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground-secondary">{label}</h2>
        {Icon && <Icon className="h-4 w-4 text-foreground-secondary" aria-hidden />}
      </div>
      {value !== undefined && (
        <p className="text-[32px] font-semibold leading-tight text-foreground-primary">{value}</p>
      )}
      {subtitle && <p className="text-sm text-foreground-secondary">{subtitle}</p>}
      {children}
    </section>
  );
}
