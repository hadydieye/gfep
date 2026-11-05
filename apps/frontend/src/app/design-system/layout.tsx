import { notFound } from 'next/navigation';

// Page de référence interne (04-UXUI-Design-System.md §9) : jamais servie en production
export default function DesignSystemLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return children;
}
