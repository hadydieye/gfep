# Plan d'implémentation — Phase 0 : Fondations (GFEP)

## Vue d'ensemble

Phase 0 établit la fondation technique complète du Guinea Finance Enterprise Portal en trois étapes séquentielles et non parallélisables :

- **Étape 0.1** — Monorepo npm workspaces + initialisation Next.js 15 et NestJS 10
- **Étape 0.2** — Docker Compose / PostgreSQL 16 + schéma Prisma 5 complet (22 modèles, 11 enums)
- **Étape 0.3** — Design system GFEP en code (tokens couleur, typographie, 6 composants shadcn/ui, page `/design-system`)

Aucun module fonctionnel métier n'est construit en Phase 0. Le seul livrable est une fondation vérifiable, exécutable et extensible sans refactoring.

---

## Tâches

- [x] 1. Étape 0.1 — Initialisation du monorepo et des applications
  - Créer la structure de répertoires `gfep/apps/frontend` et `gfep/apps/backend`
  - Configurer les scripts root (`dev`, `build`, `lint`) avec `concurrently`
  - _Requirements : 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - **Critère de passage** : `npm run dev` démarre sans erreur ; le frontend sert une page sur son port par défaut et le backend répond HTTP 200 sur `GET /api/v1/health`

  - [x] 1.1 Créer le `package.json` racine npm workspaces
    - Déclarer `"workspaces": ["apps/frontend", "apps/backend"]`
    - Ajouter `"engines": { "node": ">=22.0.0" }`
    - Ajouter les scripts `dev` (concurrently), `build` et `lint`
    - Installer `concurrently` en devDependency
    - Créer `.nvmrc` contenant uniquement `22`
    - _Requirements : 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Initialiser l'application frontend Next.js 15
    - Créer `apps/frontend` via `create-next-app@15` : TypeScript, App Router, Tailwind CSS, répertoire `src/`, alias `@/*`
    - Vérifier l'absence de tout fichier dans `pages/` (App Router uniquement)
    - Créer `apps/frontend/next.config.ts` avec configuration minimale Phase 0
    - _Requirements : 2.1, 2.2, 2.3_

  - [x] 1.3 Configurer ESLint et Prettier dans le frontend
    - Conserver `eslint-config-next` comme configuration ESLint
    - Créer `apps/frontend/.prettierrc` : `semi: true`, `trailingComma: "all"`, `singleQuote: true`, `printWidth: 100`, `tabWidth: 2`
    - _Requirements : 2.4, 2.5_

  - [x] 1.4 Initialiser l'application backend NestJS 10
    - Créer `apps/backend` via le CLI NestJS (`nest new backend --package-manager npm`)
    - Configurer `apps/backend/src/main.ts` avec le préfixe global `/api/v1` et le port `process.env.PORT ?? 3001`
    - Créer `apps/backend/src/app.module.ts` important `ConfigModule.forRoot({ isGlobal: true })`, `PrismaModule` et `HealthModule`
    - _Requirements : 3.1_

  - [x] 1.5 Implémenter le health check endpoint
    - Créer `apps/backend/src/health/health.module.ts` et `health.controller.ts`
    - Le contrôleur expose `GET /health` qui retourne `{ status: 'ok', timestamp: new Date().toISOString() }`
    - Le chemin complet résolu est `GET /api/v1/health` grâce au préfixe global
    - _Requirements : 3.2_

  - [x] 1.6 Configurer ESLint et Prettier dans le backend
    - Conserver `@nestjs/eslint-plugin` avec les règles TypeScript recommandées
    - Créer `apps/backend/.prettierrc` identique à celui du frontend
    - _Requirements : 3.3, 3.4_

- [x] 2. Checkpoint 0.1 — Vérifier le critère de passage de l'étape 0.1
  - Exécuter `npm install` depuis la racine du workspace
  - Démarrer les deux apps et confirmer : frontend répond sur `:3000`, `GET /api/v1/health` retourne HTTP 200
  - **Ne pas passer à l'étape 0.2 tant que ce critère n'est pas atteint** (cf. `06-Implementation-Plan.md` §Étape 0.1)

- [x] 3. Étape 0.2 — Docker Compose et schéma Prisma
  - Mettre en place la base de données PostgreSQL 16 via Docker Compose
  - Installer Prisma 5 dans le backend et appliquer le schéma complet de `05-Backend-Schema.md` section 3
  - _Requirements : 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - **Critère de passage** : `prisma migrate dev` réussit, les 22 tables sont visibles en base, `prisma studio` permet de les parcourir

  - [x] 3.1 Créer le fichier `docker-compose.yml` à la racine
    - Service `postgres:16-alpine` exposé sur le port 5432
    - Variables `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` lues depuis `.env`
    - Healthcheck `pg_isready` avec `interval: 10s`, `retries: 5`
    - Volume nommé `postgres_data` pour la persistance des données
    - _Requirements : 4.1, 4.2, 4.3_

  - [x] 3.2 Créer les fichiers d'environnement
    - Créer `.env.example` documentant : `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `PORT`, `NEXT_PUBLIC_API_URL`
    - Créer `.gitignore` incluant au minimum `.env` pour exclure les secrets du contrôle de version
    - Ne créer le fichier `.env` réel qu'avec les valeurs de développement local (non commité)
    - _Requirements : 4.4, 4.5_

  - [x] 3.3 Installer Prisma 5 dans le backend et configurer le service
    - Installer `prisma` et `@prisma/client` dans `apps/backend`
    - Créer `apps/backend/src/prisma/prisma.service.ts` : `PrismaService extends PrismaClient` avec `OnModuleInit` et `OnModuleDestroy`
    - Créer `apps/backend/src/prisma/prisma.module.ts` : module `@Global()` exportant `PrismaService`
    - Importer `PrismaModule` dans `AppModule`
    - Vérifier que `DATABASE_URL` est lue via `env("DATABASE_URL")` dans `schema.prisma` — jamais de valeur codée en dur
    - _Requirements : 5.1, 5.5_

  - [x] 3.4 Écrire le schéma Prisma complet
    - Créer `apps/backend/prisma/schema.prisma` en reproduisant intégralement et exactement la section 3 de `05-Backend-Schema.md`
    - Déclarer le générateur `prisma-client-js` et la datasource `postgresql` avec `url = env("DATABASE_URL")`
    - Déclarer les 11 enums : `AuthProvider`, `UserStatus`, `EmploymentStatus`, `ConfidentialityLevel`, `DocumentPermissionType`, `TransactionType`, `TransactionStatus`, `InvoiceStatus`, `NotificationType`, `AuthEventType`, `SecuritySeverity`
    - Déclarer les 22 modèles : `User`, `EmployeeIdentity`, `Session`, `AdGroupRoleMapping`, `Department`, `Position`, `Employee`, `Role`, `Permission`, `UserRole`, `RolePermission`, `DocumentCategory`, `Document`, `DocumentPermission`, `Transaction`, `Invoice`, `Notification`, `AuthEvent`, `AuditLog`, `SecurityEvent`, `LabScenario`, `ScenarioExecution`
    - Aucune modification de nommage, de type, de relation ou de contrainte par rapport au document de référence
    - _Requirements : 5.2, 5.3, 5.4_

  - [x] 3.5 Écrire les tests de vérification du schéma Prisma
    - Vérifier par parsing de `schema.prisma` que les 22 noms de modèles sont présents
    - Vérifier que les 11 noms d'enums sont présents
    - Vérifier l'absence de chaîne `postgresql://` en dur dans le fichier (usage de `env()`)
    - _Requirements : 5.2, 5.3, 5.4, 5.5_

- [x] 4. Checkpoint 0.2 — Vérifier le critère de passage de l'étape 0.2
  - Démarrer le service PostgreSQL : `docker compose up -d`
  - Exécuter `npx prisma migrate dev --name init` depuis `apps/backend`
  - Exécuter `npx prisma generate`
  - Confirmer : migration réussie, 22 tables visibles dans `prisma studio`
  - **Ne pas passer à l'étape 0.3 tant que ce critère n'est pas atteint** (cf. `06-Implementation-Plan.md` §Étape 0.2)

- [x] 5. Étape 0.3 — Design system GFEP en code
  - Définir les tokens couleur, charger la typographie et personnaliser les 6 composants shadcn/ui
  - Créer la page de référence `/design-system` affichant tous les composants
  - _Requirements : 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5_
  - **Critère de passage** : la page `/design-system` affiche les 6 composants personnalisés en mode clair et sombre, sans aucune couleur gray/slate par défaut de shadcn/ui visible

  - [x] 5.1 Configurer les tokens couleur dans `tailwind.config.ts`
    - Remplacer la configuration Tailwind existante par les tokens GFEP (section 2.1 de `04-UXUI-Design-System.md`)
    - Déclarer `darkMode: 'class'`
    - Définir les 10 rôles sémantiques (Primary, Secondary, Background Main, Background Surface, Text Primary, Text Secondary, Border, Success, Warning, Error) avec leurs valeurs light et dark
    - Déclarer l'échelle d'espacement base-4 : 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
    - Déclarer `fontFamily.sans` pointant vers `var(--font-inter)`
    - Déclarer `borderRadius.card: '8px'`
    - _Requirements : 6.1, 6.2, 6.3, 6.5_

  - [x] 5.2 Définir les CSS custom properties dans `globals.css`
    - Réécrire `apps/frontend/src/app/globals.css` avec les directives `@tailwind base/components/utilities`
    - Déclarer dans `@layer base :root { ... }` les 10 tokens couleur en mode clair
    - Déclarer dans `@layer base .dark { ... }` les 10 tokens couleur en mode sombre
    - Appliquer `@apply font-sans` sur l'élément `html`
    - _Requirements : 6.4_

  - [x] 5.3 Configurer le root layout et charger Inter via `next/font`
    - Réécrire `apps/frontend/src/app/layout.tsx` : charger `Inter` avec `variable: '--font-inter'`, `display: 'swap'`
    - Appliquer les classes `${inter.variable} font-sans antialiased` sur `<body>`
    - Ajouter `suppressHydrationWarning` sur `<html lang="fr">` pour éviter les erreurs d'hydratation liées au toggle dark mode
    - Définir les métadonnées : `title: 'GFEP — Guinea Finance Enterprise Portal'`
    - _Requirements : 7.1, 7.2, 7.3_

  - [x] 5.4 Initialiser shadcn/ui et créer `components.json`
    - Créer `apps/frontend/components.json` : style `default`, `rsc: true`, `tsx: true`, baseColor `neutral`, cssVariables activées, alias `@/components` et `@/lib/utils`
    - Créer `apps/frontend/src/lib/utils.ts` exportant le helper `cn()` (clsx + tailwind-merge)
    - Installer les dépendances shadcn/ui requises (`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `sonner`)
    - _Requirements : 2.3_

  - [x] 5.5 Implémenter le composant `Button` personnalisé
    - Créer `apps/frontend/src/components/ui/button.tsx`
    - Trois variantes GFEP : `primary` (bg-primary, texte blanc), `secondary` (border, fond transparent), `destructive` (bg-error)
    - Quatre tailles : `default` (h-9), `sm` (h-8), `lg` (h-10), `icon` (h-9 w-9)
    - Support dark mode pour chaque variante, support `asChild` via `Slot`, `forwardRef`
    - Aucune classe `gray-*` ou `slate-*` — uniquement les tokens GFEP
    - _Requirements : 8.1, 8.7_

  - [x] 5.6 Écrire le test property-based pour le composant Button (Property 1)
    - **Property 1 : Button variant color mapping**
    - Pour toute variante dans `{primary, secondary, destructive}`, vérifier l'application des classes GFEP correspondantes et l'absence de `gray-*` / `slate-*`
    - Utiliser `fc.constantFrom` avec 100 itérations minimum (Vitest + fast-check)
    - **Valide : Requirements 8.1, 8.7**

  - [x] 5.7 Implémenter le composant `Card` personnalisé
    - Créer `apps/frontend/src/components/ui/card.tsx`
    - Composants : `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`
    - `Card` : `bg-background-surface`, `border-border`, `rounded-[8px]`, `shadow-sm` (jamais d'ombre prononcée)
    - Support dark mode sur tous les sous-composants avec les tokens GFEP
    - _Requirements : 8.2, 8.7_

  - [x] 5.8 Implémenter le composant `Table` personnalisé
    - Créer `apps/frontend/src/components/ui/table.tsx`
    - Composants : `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
    - `TableHeader` : `sticky top-0 z-10` pour les en-têtes collants
    - `TableRow` : hauteur `h-10` (40px), hover léger, `data-[state=selected]` avec teinte primary
    - `TableHead` : texte `xs`, `uppercase`, `tracking-wide`, fond `bg-background-surface`
    - Support dark mode complet avec tokens GFEP
    - _Requirements : 8.3, 8.7_

  - [x] 5.9 Implémenter le composant `Input` personnalisé
    - Créer `apps/frontend/src/components/ui/input.tsx`
    - Props supplémentaires : `label?: string`, `error?: string`, `fieldId?: string`
    - Structure DOM : wrapper `flex-col gap-1.5` → `<label>` → `<input>` → message d'erreur `[role="alert"]`
    - Label toujours au-dessus du champ, erreur toujours en dessous avec la classe `text-error`
    - Attributs ARIA : `aria-invalid`, `aria-describedby` sur l'input quand `error` est présent
    - Support dark mode avec tokens GFEP
    - _Requirements : 8.4, 8.7_

  - [x] 5.10 Écrire le test property-based pour le composant Input (Property 2)
    - **Property 2 : Input label and error positioning**
    - Pour tout couple `(label: string non vide, error: string non vide)`, vérifier que le label précède l'input dans le DOM et que l'erreur suit l'input avec la classe `text-error`
    - Utiliser `fc.string({ minLength: 1 })` avec 100 itérations minimum (Vitest + fast-check + Testing Library)
    - **Valide : Requirements 8.4, 8.7**

  - [x] 5.11 Implémenter le composant `Badge` personnalisé
    - Créer `apps/frontend/src/components/ui/badge.tsx`
    - Quatre variantes sémantiques : `success`, `warning`, `error`, `neutral`
    - Forme pilule : `rounded-full`, `px-2.5 py-0.5`, `text-xs`
    - Chaque variante utilise les tokens couleur GFEP correspondants (jamais gray/slate)
    - Support dark mode avec tokens GFEP
    - _Requirements : 8.5, 8.7_

  - [x] 5.12 Écrire le test property-based pour le composant Badge (Property 3)
    - **Property 3 : Badge variant semantic color mapping**
    - Pour toute variante dans `{success, warning, error, neutral}`, vérifier la classe sémantique correcte et la présence de `rounded-full`
    - Utiliser `fc.constantFrom` avec 100 itérations minimum (Vitest + fast-check + Testing Library)
    - **Valide : Requirements 8.5, 8.7**

  - [x] 5.13 Implémenter le composant `Toast` (Sonner wrapper)
    - Créer `apps/frontend/src/components/ui/sonner.tsx`
    - Wrapper `Toaster` avec `position: "top-right"`, `richColors`, durée par défaut 4 000 ms
    - Convention documentée : les toasts d'erreur persistants utilisent `duration: Infinity` côté appelant
    - Marquer `'use client'`
    - Ajouter `<Toaster />` dans `apps/frontend/src/app/layout.tsx`
    - _Requirements : 8.6, 8.7_

  - [x] 5.14 Créer la page de référence `/design-system`
    - Créer `apps/frontend/src/app/design-system/page.tsx` marqué `'use client'`
    - Implémenter le toggle clair/sombre manipulant `document.documentElement.classList` avec persistance dans `localStorage` sous la clé `gfep-theme`
    - Section 1 — Toggle mode clair/sombre
    - Section 2 — Palette de couleurs : grille de 10 swatches avec nom, hex clair et hex sombre
    - Section 3 — Typographie : specimens aux tailles et graisses du design system
    - Section 4 — Buttons : variantes `primary`, `secondary`, `destructive` dans tous les états
    - Section 5 — Cards : avec `CardHeader`, `CardTitle`, `CardContent`
    - Section 6 — Tables : avec données d'exemple
    - Section 7 — Inputs : label + placeholder, label + erreur, sans label
    - Section 8 — Badges : variantes `success`, `warning`, `error`, `neutral`
    - Section 9 — Toasts : boutons déclenchant success 4s, info 4s, error persistant
    - _Requirements : 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 5.15 Écrire le test property-based pour la page Design System (Property 4)
    - **Property 4 : Design System page palette completeness**
    - Pour chacun des 10 tokens de la palette GFEP, vérifier que la page affiche le nom sémantique, le hex mode clair et le hex mode sombre
    - Utiliser `fc.constantFrom(...GFEP_PALETTE)` avec 100 itérations minimum (Vitest + fast-check + Testing Library)
    - **Valide : Requirements 9.3, 9.4**

- [x] 6. Checkpoint 0.3 — Vérifier le critère de passage de l'étape 0.3
  - Ouvrir `http://localhost:3000/design-system` dans un navigateur
  - Vérifier visuellement : aucun composant n'affiche les couleurs gray/slate par défaut de shadcn/ui
  - Basculer en mode sombre et confirmer que tous les tokens dark mode s'appliquent correctement
  - **Ne pas passer à la Phase MVP 1 tant que ce critère n'est pas atteint** (cf. `06-Implementation-Plan.md` §Étape 0.3)

- [x] 7. Checkpoint final Phase 0 — Vérification complète des critères de complétion
  - Ensure all tests pass, ask the user if questions arise.
  - Vérifier les 5 critères de `requirements.md` Requirement 10 :
    - `npm run dev` depuis la racine → frontend démarre sans erreur de compilation
    - `npm run dev` depuis la racine → `GET /api/v1/health` retourne HTTP 200 sans erreur runtime
    - `prisma migrate dev` contre PostgreSQL Docker → migration réussie, 22 tables créées
    - `/design-system` dans le navigateur → 6 composants affichés en clair/sombre, aucun style shadcn/ui non personnalisé visible
  - _Requirements : 10.1, 10.2, 10.3, 10.4, 10.5_

---

## Notes

- Les tâches marquées `*` sont optionnelles et peuvent être ignorées pour un déploiement MVP plus rapide, mais sont fortement recommandées pour valider les propriétés formelles du design system
- L'ordre des tâches est **séquentiel et non négociable** : chaque checkpoint doit être validé avant de commencer l'étape suivante (cf. `06-Implementation-Plan.md` section 3)
- Le schéma Prisma doit être reproduit intégralement depuis `05-Backend-Schema.md` section 3 sans aucune modification de nommage ou de structure
- Les composants shadcn/ui doivent être personnalisés avant toute utilisation dans un écran fonctionnel — jamais utilisés avec le thème gray/slate par défaut
- Hors périmètre Phase 0 : vulnérabilités pédagogiques, authentification Active Directory réelle, dispositif offensif/défensif Enterprise Breach
- Le fichier `.env` ne doit jamais être commité — seul `.env.example` entre dans le contrôle de version

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3", "1.5", "1.6"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["3.5"] },
    { "id": 7, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 8, "tasks": ["5.4"] },
    { "id": 9, "tasks": ["5.5", "5.7", "5.8", "5.9", "5.11", "5.13"] },
    { "id": 10, "tasks": ["5.6", "5.10", "5.12"] },
    { "id": 11, "tasks": ["5.14"] },
    { "id": 12, "tasks": ["5.15"] }
  ]
}
```
