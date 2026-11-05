import { Briefcase, Building2, Calculator, Monitor, Shield, TrendingUp, Users } from 'lucide-react';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DG: Building2,
  RH: Users,
  CF: Calculator,
  IT: Monitor,
  CO: TrendingUp,
  AC: Shield,
};

export function DepartmentIcon({ code, className }: { code: string; className?: string }) {
  const Icon = ICONS[code] ?? Briefcase;
  return <Icon className={className} aria-hidden />;
}
