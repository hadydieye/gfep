'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyTheme, currentTheme, type Theme } from '@/lib/theme';

/** Bascule clair / sombre (04 §5, N8), présente dans la topbar et sur /profile. */
export function ThemeToggle({ className }: { className?: string }) {
  // Lu après le montage : la classe de <html> est posée par le serveur
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => setTheme(currentTheme()), []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="secondary"
      size="icon"
      className={className}
      aria-label={next === 'dark' ? 'Activer le thème sombre' : 'Activer le thème clair'}
      aria-pressed={theme === 'dark'}
      title={next === 'dark' ? 'Thème sombre' : 'Thème clair'}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </Button>
  );
}
