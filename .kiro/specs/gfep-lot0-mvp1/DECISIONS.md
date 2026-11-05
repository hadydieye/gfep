# DECISIONS — Lot 0 (nettoyage) + MVP 1 (étapes 1.1 à 1.5)

Ce fichier consolide les décisions prises pendant la phase de clarification et les décisions par défaut retenues pour ce lot. Il accompagne `requirements.md` et sert de référence pour les phases de design et de tâches.

---

## Décisions de clarification

### C1 — TypeScript : TS5 frontend / TS6 backend (pas d'alignement)

Les deux applications sont des packages npm séparés et indépendants. Aucune tentative d'alignement de version de TypeScript n'est faite. Le frontend reste sur TS5, le backend sur TS6.

- **Décision par défaut OVERRIDDEN** : la décision par défaut d'aligner le backend TypeScript sur 5.x est **rejetée**. On conserve TS5 côté frontend et TS6 côté backend.

### C2 — Linters : oxlint backend / ESLint frontend

- Le backend utilise **oxlint** comme linter unique (configuration `.oxlintrc.json` déjà en place).
- Le frontend utilise **ESLint** avec `eslint-config-next` comme linter unique.
- Le fichier mort `apps/backend/.eslintrc.js` est supprimé.
- Les dépendances ESLint inutilisées du backend (`eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`) sont retirées du `package.json` du backend.
- Un seul linter effectif par application ; le split backend/frontend est maintenu.

### C3 — Seed MVP 1 : script minimal dédié, séparé de MVP 2

- MVP 1 dispose de son propre script de seed, distinct du seed complet de MVP 2 (étape 2.1).
- Volumétrie MVP 1 : 6 départements, ~6 postes, ~5 employés, 3 rôles (`SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`), un sous-ensemble de permissions (couvrant `employees`, `departments`, `dashboard`), et les utilisateurs correspondants (un par rôle au minimum, en comptes locaux avec mot de passe hashé argon2).
- Le seed complet de MVP 2 (40 employés, 50 documents, 8 rôles, 30–40 permissions, etc.) reste hors périmètre de ce lot.

### C4 — Session : durée de 8 heures

- La durée de validité d'une session est fixée à **8 heures** (journée de travail).
- Le champ `expiresAt` d'une `Session` est positionné à 8 heures après la création.
- Les tokens expirent après 8h ; toute session expirée est rejetée à l'accès (HTTP 401).

---

## Décisions par défaut

### D1 — TypeScript backend aligné sur 5.x → OVERRIDDEN

Voir C1. La décision par défaut d'alignement est rejetée : on garde TS5 frontend / TS6 backend.

### D2 — Source unique des tokens Tailwind v4

- La **source unique de vérité** des tokens du design system est le bloc `@theme` de `apps/frontend/src/app/globals.css`.
- Tailwind v4 ne lit pas `tailwind.config.ts` (aucune directive `@config` n'est présente).
- `tailwind.config.ts`, s'il est conservé, est marqué comme documentation/référence uniquement et n'est pas la source active.

### D3 — Alignement de la version Node

- `.nvmrc`, le champ `engines.node` du `package.json` racine, et tout pin de version runtime (CI) sont alignés sur une **même version majeure** de Node.

### D4 — Frontend→backend via les rewrites Next.js

- Le frontend communique avec le backend via les **rewrites Next.js** (`next.config.ts`), ce qui rend le cookie de session `httpOnly` same-origin.
- Pas de CORS avec credentials.
- Les variables d'environnement frontend (URL du backend) vivent dans `apps/frontend/.env.local`.

### D5 — Installer lucide-react

- `lucide-react` est ajouté aux dépendances du frontend.
- Lucide est la **seule** source d'icônes ; aucun emoji dans l'interface produit (navigation, boutons, titres).

### D6 — prisma en devDependencies / retrait du `version` de docker-compose.yml

- `prisma` (le CLI) est déplacé en `devDependencies` du backend ; `@prisma/client` reste en dépendance runtime.
- Le champ `version` obsolète est retiré de `docker-compose.yml`.

### D7 — Suppression du code mort du backend

- `apps/backend/src/app.controller.ts`, `apps/backend/src/app.service.ts` et `apps/backend/src/app.controller.spec.ts` sont supprimés.
- `AppModule` n'importe plus aucun contrôleur/service supprimé.

### D8 — La page `/` redirige vers /dashboard ou /login

- `/` redirige vers `/dashboard` si l'utilisateur est authentifié, sinon vers `/login`.
- Aucune page d'accueil autonome avec le contenu Next.js par défaut n'est rendue sur `/`.

### D9 — Un seul linter effectif (split maintenu)

- oxlint pour le backend, ESLint pour le frontend. Voir C2.

### D10 — NestJS 12 en ESM accepté

- Le backend tourne en NestJS 12 avec `"type": "module"` (ESM). Cet état est accepté tel quel pour ce lot, sans rétrogradaison ni reconfiguration.

---

## Décisions d'implémentation (exécution du lot)

### I1 — Gestionnaire de paquets : npm workspaces
Le monorepo est un workspace npm (`package-lock.json`, aucun `pnpm-workspace.yaml`). Toutes les dépendances ont été installées avec `npm install -w <app>`.

### I2 — Lecture du cookie de session via `cookie-parser`
Express 5 ne parse pas les cookies. `cookie-parser` est appliqué avec `SessionMiddleware` dans `AppModule.configure()` (pas dans `main.ts`) pour que les tests e2e en bénéficient aussi. Les chemins de middleware étant automatiquement préfixés par `api/v1`, l'exclusion s'écrit `auth/login` et la route globale `{*path}` (syntaxe path-to-regexp v8).

### I3 — IP source derrière le proxy Next.js
`trust proxy = loopback` dans `main.ts` : le rate limiting et les `AuthEvent.sourceIp` utilisent l'IP cliente relayée par les rewrites Next.js (`X-Forwarded-For`), et non `127.0.0.1` pour tous les utilisateurs.

### I4 — Attribut `Secure` du cookie
Toujours actif par défaut (Req 11.3). Les navigateurs l'acceptent sur `http://localhost`. `SESSION_COOKIE_SECURE=false` permet de le désactiver pour un accès HTTP hors localhost en développement uniquement. Nom du cookie : `SESSION_COOKIE_NAME` (défaut `gfep_session`), lu par le backend et par `getSession()`.

### I5 — Comptes non ACTIVE
Un compte `SUSPENDED` est rejeté comme un compte `LOCKED` (message générique, mot de passe non vérifié). Une session existante d'un utilisateur devenu non ACTIVE est ignorée par `SessionMiddleware`. Un utilisateur inconnu déclenche une vérification argon2 factice pour homogénéiser le temps de réponse.

### I6 — Rôle principal et Department Manager Scope
Si un utilisateur cumule des rôles, le plus élevé (`SUPER_ADMIN` > `DEPARTMENT_MANAGER` > `EMPLOYEE`) détermine le dashboard et la restriction d'écriture : un `SUPER_ADMIN` n'est jamais restreint au département.

### I7 — Postes exposés par `GET /departments`
Le formulaire employé a besoin des postes et aucun endpoint `positions` n'est prévu. `DepartmentResponseDto` inclut `positions: {id, title}[]` plutôt que d'ajouter un endpoint et une permission non seedée. Le backend refuse (400) un poste qui n'appartient pas au département choisi.

### I8 — Téléphone validé avec la région GN
`@IsPhoneNumber('GN')` accepte le format local guinéen et le format international.

### I9 — 6e employé dans le seed
Les 5 employés de design.md §8.3 laissent le département Commercial (CO) vide, ce qui contredit T1.7.1.7 (« 6 cartes avec un effectif non nul »). Le seed ajoute `GF-2026-006` Kadiatou Bangoura, Responsable commercial. Il réinitialise aussi les comptes de démo (hash, statut ACTIVE, compteur d'échecs) à chaque exécution, ce qui sert à déverrouiller après un test de verrouillage. Mots de passe surchargeables via `SEED_PASSWORD_*`.

### I10 — Bouton « Suspendre »
Il est affiché (désactivé) pour les rôles d'écriture : MVP 1 ne prévoit aucun endpoint de changement de statut. Les actions d'écriture ne sont affichées à un `DEPARTMENT_MANAGER` que pour les employés de son département, comme les règles backend.

### I11 — Seed MVP 1 réservé au développement
`prisma/seed-mvp1.ts` crée des comptes avec des mots de passe de démonstration connus et, à chaque exécution, réinitialise les comptes existants (hash, statut ACTIVE, compteur d'échecs). Il est **réservé au développement et aux tests** : il refuse de s'exécuter si `NODE_ENV=production` (message explicite sur stderr, code de sortie 1, aucune écriture en base). Un environnement de production doit être initialisé par une procédure distincte, sans mots de passe connus.

### I12 — Base de test isolée
Les tests d'intégration backend (`npm test`) utilisent une base PostgreSQL dédiée, dérivée de `DATABASE_URL` en suffixant le nom de base par `_test` (ex. `gfep_db_test`), ou fournie par `TEST_DATABASE_URL`. Le harnais refuse toute URL dont le nom de base ne se termine pas par `_test`, crée la base si besoin, applique les migrations (`prisma migrate deploy`) et la vide (TRUNCATE) au début de chaque suite. La base de développement n'est jamais touchée.
