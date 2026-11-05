# Design Document — Phase 0 Foundations (GFEP)

## Overview

Phase 0 établit la fondation technique complète du Guinea Finance Enterprise Portal. Elle est divisée en trois étapes séquentielles :

- **Étape 0.1** : Initialisation du monorepo npm workspaces avec les deux applications (Next.js 15 + NestJS 10).
- **Étape 0.2** : Configuration Docker Compose / PostgreSQL 16 et mise en place du schéma Prisma 5 complet (22 modèles, 11 enums).
- **Étape 0.3** : Implémentation du design system GFEP en code (tokens couleur, typographie, six composants shadcn/ui personnalisés, page `/design-system`).

Aucun module fonctionnel métier n'est construit en Phase 0. Le seul livrable est une fondation vérifiable, exécutable, et extensible sans refactoring pour les phases suivantes.

---

## Architecture générale

```
gfep/                               ← workspace root (npm workspaces)
├── apps/
│   ├── frontend/                   ← Next.js 15, App Router, TypeScript
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx      ← root layout (next/font, dark mode class)
│   │   │   │   ├── page.tsx        ← page d'accueil par défaut
│   │   │   │   └── design-system/
│   │   │   │       └── page.tsx    ← page de référence interne
│   │   │   ├── components/
│   │   │   │   └── ui/             ← composants shadcn/ui personnalisés
│   │   │   │       ├── button.tsx
│   │   │   │       ├── card.tsx
│   │   │   │       ├── table.tsx
│   │   │   │       ├── input.tsx
│   │   │   │       ├── badge.tsx
│   │   │   │       └── sonner.tsx  ← wrapper Toast (Sonner)
│   │   │   └── lib/
│   │   │       └── utils.ts        ← cn() helper
│   │   ├── tailwind.config.ts      ← tokens GFEP, darkMode: 'class'
│   │   ├── globals.css             ← CSS custom properties + dark mode
│   │   ├── components.json         ← registre shadcn/ui
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── .eslintrc.json
│   │   └── .prettierrc
│   │
│   └── backend/                    ← NestJS 10, TypeScript
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── main.ts             ← bootstrap, global prefix /api/v1
│       │   ├── health/
│       │   │   ├── health.module.ts
│       │   │   └── health.controller.ts
│       │   └── prisma/
│       │       ├── prisma.module.ts
│       │       └── prisma.service.ts
│       ├── prisma/
│       │   └── schema.prisma       ← copie exacte 05-Backend-Schema.md §3
│       ├── tsconfig.json
│       ├── .eslintrc.js
│       └── .prettierrc
│
├── docker-compose.yml              ← service postgres:16
├── .env                            ← variables réelles (gitignored)
├── .env.example                    ← variables documentées sans valeurs secrètes
├── .nvmrc                          ← "22"
├── .gitignore
└── package.json                    ← npm workspaces root, scripts dev/build/lint
```

---

## Étape 0.1 — Monorepo et initialisation des applications

### 1.1 Monorepo npm workspaces

Le fichier `package.json` racine déclare les workspaces et expose trois scripts concurrents via `concurrently` :

```json
{
  "name": "gfep",
  "private": true,
  "engines": {
    "node": ">=22.0.0"
  },
  "workspaces": [
    "apps/frontend",
    "apps/backend"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev -w apps/frontend\" \"npm run dev -w apps/backend\"",
    "build": "npm run build -w apps/frontend && npm run build -w apps/backend",
    "lint": "npm run lint -w apps/frontend && npm run lint -w apps/backend"
  },
  "devDependencies": {
    "concurrently": "^9.0.0"
  }
}
```

Le fichier `.nvmrc` contient uniquement la chaîne `22` pour compatibilité maximale avec `nvm use`.

### 1.2 Frontend — Next.js 15

Initialisé avec `create-next-app@15` en sélectionnant : TypeScript, App Router, Tailwind CSS, répertoire `src/`, alias `@/*`. L'App Router est le seul mode supporté — aucun fichier dans `pages/`.

**`apps/frontend/next.config.ts`** :
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Configuration minimale Phase 0
  // L'option images.domains sera étendue en Phase MVP 2
};

export default nextConfig;
```

### 1.3 Backend — NestJS 10

Initialisé avec le CLI NestJS (`nest new backend --package-manager npm`). La structure standard NestJS est conservée sans déviation.

**`apps/backend/src/main.ts`** :
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}
bootstrap();
```

**`apps/backend/src/app.module.ts`** :
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

**`apps/backend/src/health/health.controller.ts`** :
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

Le chemin complet est `GET /api/v1/health` grâce au préfixe global défini dans `main.ts`.

### 1.4 ESLint et Prettier

Les deux applications partagent une configuration Prettier identique :

**`.prettierrc`** (identique dans `apps/frontend` et `apps/backend`) :
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

Le frontend utilise `eslint-config-next`. Le backend utilise `@nestjs/eslint-plugin` avec les règles TypeScript recommandées.

---

## Étape 0.2 — Docker Compose et Prisma

### 2.1 Docker Compose

**`docker-compose.yml`** à la racine du workspace :
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: gfep_postgres
    restart: unless-stopped
    ports:
      - '5432:5432'
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**`.env.example`** :
```
# PostgreSQL (Docker Compose)
POSTGRES_DB=gfep_db
POSTGRES_USER=gfep_user
POSTGRES_PASSWORD=change_me_in_dotenv

# Backend
DATABASE_URL=postgresql://gfep_user:change_me_in_dotenv@localhost:5432/gfep_db
PORT=3001

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

Le fichier `.env` réel est exclu du contrôle de version via `.gitignore` (entrée `*.env` ou `.env` explicite).

### 2.2 Service Prisma dans NestJS

**`apps/backend/src/prisma/prisma.service.ts`** :
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**`apps/backend/src/prisma/prisma.module.ts`** :
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Le module est déclaré `@Global()` pour que `PrismaService` soit injectabledans tous les modules métier sans import explicite répété.

La `DATABASE_URL` dans `apps/backend/prisma/schema.prisma` est lue exclusivement via la directive `env()` de Prisma :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2.3 Schéma Prisma

Le fichier `apps/backend/prisma/schema.prisma` est une reproduction intégrale et exacte de la section 3 de `05-Backend-Schema.md`. Aucune modification de nommage, de type, de relation ou de contrainte n'est permise.

**Modèles déclarés (22)** :
`User`, `EmployeeIdentity`, `Session`, `AdGroupRoleMapping`, `Department`, `Position`, `Employee`, `Role`, `Permission`, `UserRole`, `RolePermission`, `DocumentCategory`, `Document`, `DocumentPermission`, `Transaction`, `Invoice`, `Notification`, `AuthEvent`, `AuditLog`, `SecurityEvent`, `LabScenario`, `ScenarioExecution`

**Enums déclarés (11)** :
`AuthProvider`, `UserStatus`, `EmploymentStatus`, `ConfidentialityLevel`, `DocumentPermissionType`, `TransactionType`, `TransactionStatus`, `InvoiceStatus`, `NotificationType`, `AuthEventType`, `SecuritySeverity`

**Générateur** :
```prisma
generator client {
  provider = "prisma-client-js"
}
```

---

## Étape 0.3 — Design System en code

### 3.1 Tokens couleur — `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F4C3A',
          dark: '#1A6B52',
        },
        secondary: {
          DEFAULT: '#C9A227',
          dark: '#D4AF37',
        },
        background: {
          main: '#FAFAF8',
          surface: '#FFFFFF',
          'main-dark': '#0D0F0E',
          'surface-dark': '#16181A',
        },
        foreground: {
          primary: '#111418',
          secondary: '#5C6168',
          'primary-dark': '#F2F3F2',
          'secondary-dark': '#9AA0A6',
        },
        border: {
          DEFAULT: '#E4E6E8',
          dark: '#2A2D30',
        },
        success: {
          DEFAULT: '#1B8A5A',
          dark: '#2FA873',
        },
        warning: {
          DEFAULT: '#B8860B',
          dark: '#D4A017',
        },
        error: {
          DEFAULT: '#C0392B',
          dark: '#E05A4A',
        },
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
```

### 3.2 Variables CSS — `globals.css`

Les tokens sont également déclarés comme CSS custom properties pour un accès direct hors Tailwind (ex : scripts de visualisation, PDF, Storybook futur) :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Primary */
    --color-primary: #0F4C3A;
    --color-primary-dark: #1A6B52;

    /* Secondary */
    --color-secondary: #C9A227;
    --color-secondary-dark: #D4AF37;

    /* Background */
    --color-background-main: #FAFAF8;
    --color-background-surface: #FFFFFF;

    /* Foreground */
    --color-foreground-primary: #111418;
    --color-foreground-secondary: #5C6168;

    /* Border */
    --color-border: #E4E6E8;

    /* Semantic */
    --color-success: #1B8A5A;
    --color-warning: #B8860B;
    --color-error: #C0392B;
  }

  .dark {
    --color-primary: #1A6B52;
    --color-primary-dark: #1A6B52;

    --color-secondary: #D4AF37;
    --color-secondary-dark: #D4AF37;

    --color-background-main: #0D0F0E;
    --color-background-surface: #16181A;

    --color-foreground-primary: #F2F3F2;
    --color-foreground-secondary: #9AA0A6;

    --color-border: #2A2D30;

    --color-success: #2FA873;
    --color-warning: #D4A017;
    --color-error: #E05A4A;
  }

  html {
    @apply font-sans;
  }
}
```

### 3.3 Typographie — Root Layout

**`apps/frontend/src/app/layout.tsx`** :
```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GFEP — Guinea Finance Enterprise Portal',
  description: 'Portail de gestion interne GUINEA FINANCE SARL',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

La police Inter est chargée via `next/font/google` avec une CSS variable `--font-inter`, référencée dans `tailwind.config.ts` sous `fontFamily.sans`. L'attribut `suppressHydrationWarning` sur `<html>` est requis pour éviter les erreurs d'hydratation liées à la classe `dark` appliquée côté client.

### 3.4 Configuration shadcn/ui

**`apps/frontend/components.json`** :
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### 3.5 Composants shadcn/ui personnalisés

#### Button (`apps/frontend/src/components/ui/button.tsx`)

Trois variantes GFEP remplaçant les variantes shadcn/ui par défaut :

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Variante primaire : fond primary, texte blanc
        primary:
          'bg-primary text-white hover:bg-primary/90 dark:bg-primary-dark dark:hover:bg-primary-dark/90',
        // Variante secondaire : contour border, fond transparent
        secondary:
          'border border-border bg-transparent text-foreground-primary hover:bg-background-main dark:border-border-dark dark:text-foreground-primary-dark dark:hover:bg-background-main-dark',
        // Variante destructive : fond error
        destructive:
          'bg-error text-white hover:bg-error/90 dark:bg-error-dark dark:hover:bg-error-dark/90',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

#### Card (`apps/frontend/src/components/ui/card.tsx`)

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-background-surface border border-border rounded-[8px] shadow-sm',
        'dark:bg-background-surface-dark dark:border-border-dark',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-foreground-primary dark:text-foreground-primary-dark',
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardContent, CardFooter };
```

#### Table (`apps/frontend/src/components/ui/table.tsx`)

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

// En-têtes collants : sticky top-0, z-index supérieur au contenu
const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('sticky top-0 z-10', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        // Hauteur de ligne standard 40px + hover léger
        'h-10 border-b border-border transition-colors',
        'hover:bg-background-main dark:border-border-dark dark:hover:bg-background-main-dark',
        'data-[state=selected]:bg-primary/10',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide',
      'bg-background-surface text-foreground-secondary border-b border-border',
      'dark:bg-background-surface-dark dark:text-foreground-secondary-dark dark:border-border-dark',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-4 py-2 align-middle text-foreground-primary dark:text-foreground-primary-dark',
      className,
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

#### Input (`apps/frontend/src/components/ui/input.tsx`)

Le composant Input expose une prop `error` pour afficher le message sous le champ, et rend le label au-dessus dans un wrapper `flex-col` :

```typescript
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
    const resolvedId = fieldId ?? id ?? React.useId();

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
            'border-border text-foreground-primary placeholder:text-foreground-secondary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-background-surface-dark dark:border-border-dark',
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
```

#### Badge (`apps/frontend/src/components/ui/badge.tsx`)

```typescript
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // Forme pilule + texte court
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        success:
          'bg-success/15 text-success dark:bg-success-dark/20 dark:text-success-dark',
        warning:
          'bg-warning/15 text-warning dark:bg-warning-dark/20 dark:text-warning-dark',
        error:
          'bg-error/15 text-error dark:bg-error-dark/20 dark:text-error-dark',
        neutral:
          'bg-border/40 text-foreground-secondary dark:bg-border-dark/40 dark:text-foreground-secondary-dark',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

#### Toast — Sonner wrapper (`apps/frontend/src/components/ui/sonner.tsx`)

```typescript
'use client';

import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      richColors
      toastOptions={{
        duration: 4000,           // 4s pour success et info
        classNames: {
          error: 'toast-error',   // La durée infinie est gérée par l'appelant
        },
      }}
      {...props}
    />
  );
};

// Utilitaire exposé pour les toast d'erreur persistants
// Usage : showErrorToast('Message d\'erreur')
export { Toaster };
```

> **Note d'implémentation** : pour les toasts d'erreur persistants, l'appelant passe `duration: Infinity` lors du déclenchement : `toast.error('Message', { duration: Infinity })`. Cette convention est documentée dans la page `/design-system`.

### 3.6 Page `/design-system`

La route est accessible à `apps/frontend/src/app/design-system/page.tsx`. Elle n'est pas liée dans la navigation principale et peut être conditionnée à `process.env.NODE_ENV !== 'production'` dans un middleware si nécessaire.

Structure de la page :

```typescript
// apps/frontend/src/app/design-system/page.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Sections rendues :
// 1. Toggle mode clair/sombre (ajoute/retire la classe 'dark' sur <html>)
// 2. Palette de couleurs (grid de swatches : nom, hex clair, hex sombre)
// 3. Typographie (specimens aux tailles et graisses du design system)
// 4. Buttons (primary, secondary, destructive — tous états)
// 5. Cards (avec CardHeader, CardTitle, CardContent)
// 6. Tables (avec données exemple)
// 7. Inputs (label + placeholder, label + error, sans label)
// 8. Badges (success, warning, error, neutral)
// 9. Toasts (déclenchés par bouton : success 4s, info 4s, error persistant)
```

La page implémente un toggle qui manipule directement `document.documentElement.classList` pour ajouter/retirer `dark`. La préférence est persistée dans `localStorage` sous la clé `gfep-theme`.

---

## Modèle de données — Vue d'ensemble Phase 0

Phase 0 ne crée pas de données métier. Le schéma Prisma est appliqué en migration initiale et reste vide jusqu'au seed de la Phase MVP 2 (étape 2.1). Les relations entre les 22 modèles sont documentées exhaustivement dans `05-Backend-Schema.md` section 4. Voici les domaines et leur volumétrie cible :

| Domaine | Modèles | Tables créées |
|---------|---------|---------------|
| Identity | User, EmployeeIdentity, Session, AdGroupRoleMapping | 4 |
| Organization | Department, Position, Employee | 3 |
| Access Control | Role, Permission, UserRole, RolePermission | 4 |
| Documents | DocumentCategory, Document, DocumentPermission | 3 |
| Finance | Transaction, Invoice | 2 |
| Application | Notification, AuthEvent | 2 |
| Security & Audit | AuditLog, SecurityEvent, LabScenario, ScenarioExecution | 4 |
| **Total** | **22 modèles** | **22 tables** |

---

## Gestion des erreurs et états de l'interface

### Erreurs de configuration (Phase 0 uniquement)

Puisque Phase 0 ne construit pas de module fonctionnel, les erreurs à gérer sont des erreurs d'infrastructure :

| Situation | Comportement attendu |
|-----------|---------------------|
| `DATABASE_URL` absent au démarrage du backend | NestJS lance une `Error` explicite avec le message de la variable manquante (comportement natif `@nestjs/config`) |
| Migration Prisma échoue (DB inaccessible) | `prisma migrate dev` affiche l'erreur de connexion — le développeur doit vérifier que Docker Compose est démarré |
| Port 3000/3001 déjà occupé | `EADDRINUSE` natif Node.js — résoudre en changeant `PORT` dans `.env` |
| `next/font` ne charge pas Inter | Fallback `ui-sans-serif` via la configuration `fontFamily.sans` dans Tailwind — visible mais non bloquant |

### Page `/design-system` — états à prévoir

La page de référence doit gérer :
- **Toast overflow** : Sonner empile les toasts et tronque au-delà de 3 (comportement natif) — ne pas surcharger par des clics répétés sur les boutons de démonstration.
- **Toggle dark mode SSR** : l'attribut `suppressHydrationWarning` sur `<html>` dans le layout prévient les erreurs d'hydratation React lors de l'application initiale de la classe `dark`.

---

## Séquence d'initialisation de la fondation

```
1. npm install (racine workspace)
        ↓
2. cp .env.example .env
   (remplir POSTGRES_PASSWORD)
        ↓
3. docker compose up -d
   → postgres:16 démarre, healthcheck passe
        ↓
4. npm run dev (racine)
   → Next.js 15 sur :3000
   → NestJS 10 sur :3001
        ↓
5. GET /api/v1/health → { status: 'ok' }
        ↓
6. cd apps/backend
   npx prisma migrate dev --name init
   → 22 tables créées
        ↓
7. npx prisma generate
   → @prisma/client compilé
        ↓
8. Ouvrir http://localhost:3000/design-system
   → Vérification visuelle du design system
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Button variant color mapping

*For any* button variant in `{primary, secondary, destructive}`, rendering a `Button` component with that variant SHALL apply the corresponding GFEP color class: `bg-primary` for primary, a `border` class for secondary, and `bg-error` for destructive — never a default shadcn/ui gray or slate class.

**Validates: Requirements 8.1, 8.7**

---

### Property 2: Input label and error positioning

*For any* `Input` component rendered with a non-empty `error` prop, the rendered DOM SHALL always contain the label element before the input element (label above), and the error message element after the input element (error below) with the `text-error` class — regardless of the input's other props or value.

**Validates: Requirements 8.4, 8.7**

---

### Property 3: Badge variant semantic color mapping

*For any* badge variant in `{success, warning, error, neutral}`, rendering a `Badge` component SHALL apply the correct GFEP semantic color class for that variant (success color for success, warning color for warning, error color for error, border/neutral color for neutral), and SHALL have the pill shape class (`rounded-full`).

**Validates: Requirements 8.5, 8.7**

---

### Property 4: Design System page palette completeness

*For any* color token in the GFEP Design System Palette (the ten roles: Primary, Secondary, Background Main, Background Surface, Text Primary, Text Secondary, Border, Success, Warning, Error), the `/design-system` page SHALL display the token's semantic name, its light-mode hex value, and its dark-mode hex value.

**Validates: Requirements 9.3, 9.4**

---

## Testing Strategy

### Approche duale

Phase 0 est essentiellement une phase de configuration et d'infrastructure. La majorité des critères sont vérifiables par des tests structurels (fichiers, configuration) ou des smoke tests (démarrage, endpoint HTTP). Quatre propriétés universelles s'appliquent aux composants UI personnalisés.

### Tests de configuration (smoke)

Ces vérifications s'exécutent une seule fois et valident l'état de la fondation :

| Vérification | Ce qui est testé |
|---|---|
| `package.json` workspaces | Présence de `apps/frontend` et `apps/backend` dans le champ `workspaces` |
| `.nvmrc` | Contient `22` |
| `engines.node` | Champ `engines` dans le `package.json` racine |
| Scripts root (`dev`, `build`, `lint`) | Présence dans `package.json.scripts` |
| `tailwind.config.ts` `darkMode: 'class'` | Stratégie dark mode correcte |
| `components.json` | Présence dans `apps/frontend` |
| Route `/design-system` | Présence de `apps/frontend/src/app/design-system/page.tsx` |
| `prisma` version ≥ 5 | Champ `version` dans `node_modules/prisma/package.json` |

### Tests d'exemple (example-based)

| Vérification | Méthode |
|---|---|
| `GET /api/v1/health` retourne 200 | Jest + Supertest |
| Schéma Prisma contient les 22 modèles | Parser le fichier `schema.prisma`, vérifier les noms |
| Schéma Prisma contient les 11 enums | Parser le fichier `schema.prisma`, vérifier les noms |
| `DATABASE_URL` lu via `env()` dans `schema.prisma` | Vérifier l'absence de chaîne `postgresql://` en dur |
| Tokens couleur dans `tailwind.config.ts` | Vérifier les 10 clés et leurs valeurs hex |
| CSS custom properties dans `globals.css` | Vérifier la présence des 10 tokens en `:root` et `.dark` |
| `next/font` dans `layout.tsx` | Vérifier l'import et l'application de la variable CSS |
| Rendu Card avec les bonnes classes GFEP | Vitest + Testing Library |
| Rendu Table avec sticky header | Vitest + Testing Library |
| Configuration Toast (position, duration) | Inspecter les props du composant Toaster |

### Tests d'intégration

| Vérification | Méthode |
|---|---|
| `docker compose up -d` démarre PostgreSQL | Vérifier connexion TCP sur port 5432 |
| `prisma migrate dev` crée les 22 tables | Requête `information_schema.tables` après migration |

### Tests property-based (Vitest + fast-check)

Quatre propriétés universelles sur les composants UI — chacune exécutée avec 100 itérations minimum :

**Property 1 — Button variant color mapping**
```typescript
// Tag: Feature: gfep-phase-0-foundations, Property 1: Button variant color mapping
fc.assert(
  fc.property(
    fc.constantFrom('primary', 'secondary', 'destructive'),
    (variant) => {
      const { container } = render(<Button variant={variant}>Test</Button>);
      const btn = container.querySelector('button')!;
      if (variant === 'primary') expect(btn.className).toContain('bg-primary');
      if (variant === 'secondary') expect(btn.className).toContain('border');
      if (variant === 'destructive') expect(btn.className).toContain('bg-error');
      // Aucune des trois variantes ne doit contenir une classe gray ou slate par défaut
      expect(btn.className).not.toMatch(/\b(gray|slate)-\d+\b/);
    },
  ),
);
```

**Property 2 — Input label and error positioning**
```typescript
// Tag: Feature: gfep-phase-0-foundations, Property 2: Input label and error positioning
fc.assert(
  fc.property(
    fc.string({ minLength: 1 }),  // label non vide
    fc.string({ minLength: 1 }),  // error non vide
    fc.string(),                  // valeur quelconque
    (label, error, value) => {
      const { container } = render(
        <Input label={label} error={error} value={value} onChange={() => {}} />,
      );
      const wrapper = container.firstChild as HTMLElement;
      const children = Array.from(wrapper.children);
      const labelIdx = children.findIndex((el) => el.tagName === 'LABEL');
      const inputIdx = children.findIndex((el) => el.tagName === 'INPUT');
      const errorEl = wrapper.querySelector('[role="alert"]');
      // Label avant input
      expect(labelIdx).toBeLessThan(inputIdx);
      // Erreur après input
      expect(errorEl).not.toBeNull();
      expect(errorEl!.className).toContain('text-error');
    },
  ),
);
```

**Property 3 — Badge variant semantic color mapping**
```typescript
// Tag: Feature: gfep-phase-0-foundations, Property 3: Badge variant semantic color mapping
fc.assert(
  fc.property(
    fc.constantFrom('success', 'warning', 'error', 'neutral'),
    (variant) => {
      const { container } = render(<Badge variant={variant}>Label</Badge>);
      const badge = container.querySelector('span')!;
      expect(badge.className).toContain('rounded-full');
      if (variant === 'success') expect(badge.className).toContain('success');
      if (variant === 'warning') expect(badge.className).toContain('warning');
      if (variant === 'error') expect(badge.className).toContain('error');
      if (variant === 'neutral') expect(badge.className).toMatch(/border|neutral/);
    },
  ),
);
```

**Property 4 — Design System page palette completeness**
```typescript
// Tag: Feature: gfep-phase-0-foundations, Property 4: Design System page palette completeness
const GFEP_PALETTE = [
  { name: 'Primary', lightHex: '#0F4C3A', darkHex: '#1A6B52' },
  { name: 'Secondary', lightHex: '#C9A227', darkHex: '#D4AF37' },
  { name: 'Background Main', lightHex: '#FAFAF8', darkHex: '#0D0F0E' },
  { name: 'Background Surface', lightHex: '#FFFFFF', darkHex: '#16181A' },
  { name: 'Text Primary', lightHex: '#111418', darkHex: '#F2F3F2' },
  { name: 'Text Secondary', lightHex: '#5C6168', darkHex: '#9AA0A6' },
  { name: 'Border', lightHex: '#E4E6E8', darkHex: '#2A2D30' },
  { name: 'Success', lightHex: '#1B8A5A', darkHex: '#2FA873' },
  { name: 'Warning', lightHex: '#B8860B', darkHex: '#D4A017' },
  { name: 'Error', lightHex: '#C0392B', darkHex: '#E05A4A' },
];

fc.assert(
  fc.property(
    fc.constantFrom(...GFEP_PALETTE),
    (token) => {
      const { getByText } = render(<DesignSystemPage />);
      // Chaque token doit avoir son nom et ses deux valeurs hex visibles
      expect(getByText(new RegExp(token.lightHex, 'i'))).toBeInTheDocument();
      expect(getByText(new RegExp(token.darkHex, 'i'))).toBeInTheDocument();
    },
  ),
);
```
