'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const GFEP_PALETTE = [
  { name: 'Primary', light: '#0F4C3A', dark: '#1A6B52' },
  { name: 'Secondary', light: '#C9A227', dark: '#D4AF37' },
  { name: 'Background Main', light: '#FAFAF8', dark: '#0D0F0E' },
  { name: 'Background Surface', light: '#FFFFFF', dark: '#16181A' },
  { name: 'Text Primary', light: '#111418', dark: '#F2F3F2' },
  { name: 'Text Secondary', light: '#5C6168', dark: '#9AA0A6' },
  { name: 'Border', light: '#E4E6E8', dark: '#2A2D30' },
  { name: 'Success', light: '#1B8A5A', dark: '#2FA873' },
  { name: 'Warning', light: '#B8860B', dark: '#D4A017' },
  { name: 'Error', light: '#C0392B', dark: '#E05A4A' },
];

export default function DesignSystemPage() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('gfep-theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('gfep-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('gfep-theme', 'light');
    }
  };

  return (
    <div className="min-h-screen bg-background-main dark:bg-background-main-dark p-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <h1 className="text-3xl font-bold text-foreground-primary dark:text-foreground-primary-dark">
          GFEP Design System
        </h1>

        {/* Section 1 — Toggle mode clair/sombre */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            1. Mode clair / sombre
          </h2>
          <Button variant="secondary" onClick={toggleTheme}>
            {isDark ? 'Mode clair' : 'Mode sombre'}
          </Button>
        </section>

        {/* Section 2 — Palette de couleurs */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            2. Palette de couleurs
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {GFEP_PALETTE.map((token) => (
              <div key={token.name} className="space-y-2">
                <div className="flex gap-1">
                  <div
                    className="h-16 flex-1 rounded-[8px] border border-border dark:border-border-dark"
                    style={{ backgroundColor: token.light }}
                    title={`Light: ${token.light}`}
                  />
                  <div
                    className="h-16 flex-1 rounded-[8px] border border-border dark:border-border-dark"
                    style={{ backgroundColor: token.dark }}
                    title={`Dark: ${token.dark}`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground-primary dark:text-foreground-primary-dark">
                    {token.name}
                  </p>
                  <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                    Clair: {token.light}
                  </p>
                  <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                    Sombre: {token.dark}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 — Typographie */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            3. Typographie
          </h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  text-xs (12px)
                </p>
                <p className="text-xs">Portail de gestion interne GUINEA FINANCE SARL</p>
              </div>
              <div>
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  text-sm (14px)
                </p>
                <p className="text-sm">Portail de gestion interne GUINEA FINANCE SARL</p>
              </div>
              <div>
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  text-base (16px)
                </p>
                <p className="text-base">Portail de gestion interne GUINEA FINANCE SARL</p>
              </div>
              <div>
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  text-lg (18px)
                </p>
                <p className="text-lg">Portail de gestion interne GUINEA FINANCE SARL</p>
              </div>
              <div>
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  text-xl (20px)
                </p>
                <p className="text-xl">Portail de gestion interne GUINEA FINANCE SARL</p>
              </div>
              <div>
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  text-3xl font-bold (30px)
                </p>
                <p className="text-3xl font-bold">Portail de gestion interne</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 4 — Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            4. Buttons
          </h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  Variante primary
                </p>
                <div className="flex gap-4">
                  <Button variant="primary" size="sm">
                    Small
                  </Button>
                  <Button variant="primary" size="default">
                    Default
                  </Button>
                  <Button variant="primary" size="lg">
                    Large
                  </Button>
                  <Button variant="primary" size="icon">
                    ★
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  Variante secondary
                </p>
                <div className="flex gap-4">
                  <Button variant="secondary" size="sm">
                    Small
                  </Button>
                  <Button variant="secondary" size="default">
                    Default
                  </Button>
                  <Button variant="secondary" size="lg">
                    Large
                  </Button>
                  <Button variant="secondary" size="icon">
                    ★
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                  Variante destructive
                </p>
                <div className="flex gap-4">
                  <Button variant="destructive" size="sm">
                    Small
                  </Button>
                  <Button variant="destructive" size="default">
                    Default
                  </Button>
                  <Button variant="destructive" size="lg">
                    Large
                  </Button>
                  <Button variant="destructive" size="icon">
                    ★
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 5 — Cards */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            5. Cards
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Exemple de carte</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground-secondary dark:text-foreground-secondary-dark">
                  Contenu de la carte avec un texte descriptif.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Carte avec actions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground-secondary dark:text-foreground-secondary-dark">
                  Cette carte contient des actions rapides.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="primary" size="sm">
                    Confirmer
                  </Button>
                  <Button variant="secondary" size="sm">
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 6 — Tables */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            6. Tables
          </h2>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Mamadou Diallo</TableCell>
                    <TableCell>Analyste</TableCell>
                    <TableCell>
                      <Badge variant="success">Actif</Badge>
                    </TableCell>
                    <TableCell>2024-01-15</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Aïssatou Bah</TableCell>
                    <TableCell>Comptable</TableCell>
                    <TableCell>
                      <Badge variant="warning">Suspendu</Badge>
                    </TableCell>
                    <TableCell>2024-03-22</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Ousmane Camara</TableCell>
                    <TableCell>Manager</TableCell>
                    <TableCell>
                      <Badge variant="error">Inactif</Badge>
                    </TableCell>
                    <TableCell>2023-11-08</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Section 7 — Inputs */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            7. Inputs
          </h2>
          <Card>
            <CardContent className="space-y-6 pt-6">
              <Input label="Nom complet" placeholder="Entrez votre nom" fieldId="input-name" />
              <Input label="Email" error="L'email est requis" fieldId="input-email" />
              <Input placeholder="Sans label" fieldId="input-nolabel" />
            </CardContent>
          </Card>
        </section>

        {/* Section 8 — Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            8. Badges
          </h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-4">
                <Badge variant="success">Succès</Badge>
                <Badge variant="warning">Avertissement</Badge>
                <Badge variant="error">Erreur</Badge>
                <Badge variant="neutral">Neutre</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 9 — Toasts */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground-primary dark:text-foreground-primary-dark">
            9. Toasts
          </h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex gap-4">
                <Button variant="primary" onClick={() => toast.success('Opération réussie')}>
                  Success (4s)
                </Button>
                <Button variant="secondary" onClick={() => toast.info('Information')}>
                  Info (4s)
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => toast.error('Erreur persistante', { duration: Infinity })}
                >
                  Error (persistant)
                </Button>
              </div>
              <p className="text-xs text-foreground-secondary dark:text-foreground-secondary-dark">
                Convention : les toasts d&apos;erreur utilisent{' '}
                <code>duration: Infinity</code> côté appelant.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
