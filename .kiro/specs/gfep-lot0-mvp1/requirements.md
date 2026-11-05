# Requirements Document

## Introduction

Ce document définit les exigences du lot **Lot 0 (nettoyage) + MVP 1 (étapes 1.1 à 1.5)** du Guinea Finance Enterprise Portal (GFEP). Il couvre, dans l'ordre exact du `06-Implementation-Plan.md` :

- **Lot 0 — Nettoyage** : assainissement de la fondation laissée par la Phase 0 — suppression du code mort du backend, consolidation des linters (oxlint backend / ESLint frontend), confirmation de la source unique des tokens Tailwind v4, alignement de la version Node, configuration des rewrites Next.js frontend→backend, installation de `lucide-react`, déplacement de `prisma` en `devDependencies`, nettoyage du `docker-compose.yml`, et redirection de la page d'accueil.
- **Étape 1.1 — Authentification locale** : endpoints `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, hash `argon2`, verrouillage après 5 échecs, sessions serveur (cookie httpOnly, token hashé, durée 8h), rate limiting 5/15min, écran `/login`.
- **Étape 1.2 — RBAC basique (3 rôles)** : `SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`, guards de rôle et de permission.
- **Étape 1.3 — Module Dashboard (version simplifiée)** : indicateurs de base, contenu adapté aux 3 rôles.
- **Étape 1.4 — Module Employés (CRUD complet)** : liste paginée, détail, création, modification, permissions de lecture pour tous et d'écriture pour le Department Manager (son département) et le Super Admin.
- **Étape 1.5 — Module Départements (lecture + gestion simple)** : liste et détail des 6 départements, effectif réel calculé depuis `employees`.
- **Seed MVP 1** : script de seed minimal dédié (6 départements, ~6 postes, ~5 employés, 3 rôles, sous-ensemble de permissions, utilisateurs correspondants), séparé du seed complet de MVP 2.

Aucune réordonnancement, fusion ou saut d'étape n'est autorisé. Les exigences sont traçables vers `01-PRD.md`, `02-TRD.md`, `03-AppFlow.md`, `04-UXUI-Design-System.md`, `05-Backend-Schema.md` et `06-Implementation-Plan.md`.

### Hors périmètre

Les vulnérabilités pédagogiques, le `LAB_MODE`, le vrai Active Directory, Wazuh/Sysmon et tout dispositif offensif/défensif sont explicitement exclus. L'authentification Active Directory (étape 2.7), les 5 rôles restants (étape 2.4), le seed complet (étape 2.1) et les modules Documents/Finance/Notifications/Audit sont hors de ce lot.

---

## Décisions et hypothèses

Les décisions suivantes, issues de la phase de clarification et des décisions par défaut, encadrent ce lot. Elles sont documentées de façon détaillée dans `DECISIONS.md`.

1. **TypeScript** : TS5 côté frontend / TS6 côté backend — pas d'alignement, les deux sont des packages npm séparés. La décision par défaut d'aligner le backend sur 5.x est **OVERRIDDEN**.
2. **Linters** : oxlint pour le backend, ESLint (`eslint-config-next`) pour le frontend. Le `.eslintrc.js` mort du backend et les dépendances ESLint inutilisées du backend sont supprimés. Un seul linter effectif par application ; le split est maintenu.
3. **Tailwind v4** : une seule source de vérité pour les tokens — `globals.css` (directive `@theme`). `tailwind.config.ts` n'est pas lu par Tailwind v4 (pas de directive `@config`).
4. **Version Node** : `.nvmrc`, champ `engines` et runtime d'exécution alignés sur une seule version.
5. **Frontend→backend** : via les rewrites Next.js (cookie httpOnly en same-origin, pas de CORS avec credentials). Les variables d'environnement frontend vivent dans `apps/frontend/.env.local`.
6. **Icônes** : `lucide-react` installé (Lucide exclusivement, aucun emoji).
7. **Prisma** : déplacé en `devDependencies`. Le champ `version` est retiré de `docker-compose.yml`.
8. **Code mort backend** : `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts` supprimés.
9. **Page d'accueil** : `/` redirige vers `/dashboard` (si authentifié) ou `/login` (si non authentifié).
10. **NestJS 12 en ESM** : accepté tel quel.
11. **Seed MVP 1** : script minimal dédié, séparé du seed complet de MVP 2 — 6 départements, ~6 postes, ~5 employés, 3 rôles (`SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`), un sous-ensemble de permissions, et les utilisateurs correspondants.
12. **Session** : durée de 8 heures (journée de travail). Les tokens expirent après 8h.

---

## Glossary

- **Backend** : l'application NestJS 12 + TypeScript (`type: "module"`, ESM) située dans `apps/backend`, exposant l'API REST sous le préfixe global `/api/v1`.
- **Frontend** : l'application Next.js 15 (App Router) + TypeScript située dans `apps/frontend`.
- **Dead Code** : les fichiers de scaffolding inutilisés laissés par l'initialisation NestJS — `apps/backend/src/app.controller.ts`, `apps/backend/src/app.service.ts`, `apps/backend/src/app.controller.spec.ts` — qui ne sont référencés par aucun module.
- **oxlint** : le linter utilisé exclusivement par le Backend (configuration `.oxlintrc.json`).
- **ESLint** : le linter utilisé exclusivement par le Frontend, via `eslint-config-next`.
- **Tailwind v4** : la version 4 de Tailwind CSS utilisée par le Frontend, où la directive `@theme` dans `globals.css` est l'unique source de vérité des tokens.
- **Tailwind Theme File** : le fichier `apps/frontend/src/app/globals.css` contenant le bloc `@theme { ... }` définissant tous les tokens du design system.
- **Next.js Rewrites** : la configuration de `next.config.ts` qui proxie les requêtes `/api/v1/*` du Frontend vers le Backend, rendant le cookie de session same-origin et évitant le CORS avec credentials.
- **lucide-react** : la bibliothèque d'icônes Lucide pour React, unique source d'icônes de l'interface.
- **argon2** : la fonction de hachage de mots de passe utilisée par le Backend (jamais md5/sha1/sha256 nu).
- **Session** : une ligne de la table `sessions` représentant une session serveur, associée à un `User`, avec un `sessionTokenHash` unique, une `ipAddress`, un `userAgent`, un `expiresAt` et un `revokedAt` optionnel.
- **Session Token** : la valeur secrète générée à la connexion, transmise uniquement au client via un cookie httpOnly, et stockée en base uniquement sous forme hashée (`sessionTokenHash`).
- **Session Cookie** : le cookie `httpOnly`, `secure`, `sameSite=strict` posé par le Backend pour transmettre le Session Token.
- **Session Lifetime** : la durée de validité d'une session, fixée à 8 heures à compter de la création.
- **Account Lockout** : le passage du `status` d'un `User` à `LOCKED` après 5 échecs de connexion consécutifs.
- **Rate Limiting** : la limitation à 5 tentatives de connexion par fenêtre de 15 minutes par adresse IP, sur `/auth/login` et `/auth/login-ad`.
- **Failed Login Count** : le compteur `failedLoginCount` d'un `User`, incrémenté à chaque échec et remis à 0 en cas de succès.
- **RBAC** : le contrôle d'accès basé sur les rôles (Role-Based Access Control) vérifié côté serveur sur chaque endpoint sensible.
- **Role Guard** : le guard NestJS vérifiant qu'au moins un des rôles de l'utilisateur figure dans le décorateur `@Roles(...)` du contrôleur.
- **Permission Guard** : le guard NestJS vérifiant, via `Permission (resource, action)`, que l'utilisateur détient la permission précise demandée.
- **MVP 1 Roles** : les trois rôles créés à l'étape 1.2 : `SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`.
- **Department Manager Scope** : la restriction selon laquelle un `DEPARTMENT_MANAGER` ne peut écrire que sur les employés et les données de son propre département.
- **Seed MVP 1** : le script de seed Prisma minimal dédié à MVP 1, distinct du seed complet de MVP 2.
- **Dashboard** : l'écran `/dashboard` affichant des indicateurs et des accès rapides adaptés au rôle de l'utilisateur connecté.
- **Generic Error Message** : le message d'erreur neutre renvoyé par le Backend en cas d'échec d'authentification, ne révélant jamais l'existence d'un compte.
- **Pagination** : la pagination obligatoire des endpoints de liste via les paramètres `?page=` et `?limit=`, avec une limite par défaut de 25.

---

## Requirements

### Requirement 1 — Lot 0 : Suppression du code mort du backend

**User Story:** En tant que développeur, je veux que le code mort de scaffolding du backend soit supprimé, afin que la base de code ne contienne que du code réellement utilisé.

#### Acceptance Criteria

1. THE Backend SHALL NOT contain the files `apps/backend/src/app.controller.ts`, `apps/backend/src/app.service.ts`, and `apps/backend/src/app.controller.spec.ts`.
2. WHEN the Backend is compiled and started, THE Backend SHALL start without errors and without any reference to the removed files.
3. THE Backend `AppModule` SHALL import only `ConfigModule`, `PrismaModule`, and `HealthModule` and SHALL NOT import a removed controller or service.

---

### Requirement 2 — Lot 0 : Consolidation des linters (oxlint backend / ESLint frontend)

**User Story:** En tant que développeur, je veux qu'une seule chaîne de linting effective s'applique à chaque application, afin d'éviter une configuration dupliquée ou morte.

#### Acceptance Criteria

1. THE Backend SHALL use oxlint as its sole linter and SHALL NOT contain the dead file `apps/backend/.eslintrc.js`.
2. THE Backend `package.json` SHALL NOT list ESLint dependencies that are unused by oxlint, specifically `eslint`, `@typescript-eslint/eslint-plugin`, and `@typescript-eslint/parser`, as runtime or lint dependencies.
3. THE Frontend SHALL use ESLint with `eslint-config-next` as its sole linter.
4. WHEN `npm run lint` is executed from the workspace root, THE Monorepo SHALL run oxlint for the Backend and ESLint for the Frontend without configuration errors.

---

### Requirement 3 — Lot 0 : Source unique des tokens Tailwind v4

**User Story:** En tant que développeur, je veux une source unique de vérité pour les tokens Tailwind v4, afin d'éviter une divergence entre `globals.css` et `tailwind.config.ts`.

#### Acceptance Criteria

1. THE Frontend SHALL define all design system tokens exclusively in the `@theme` block of `apps/frontend/src/app/globals.css`.
2. THE Frontend SHALL NOT include a `@config` directive in `globals.css`, so that `tailwind.config.ts` is not read by Tailwind v4.
3. WHERE `tailwind.config.ts` is retained, THE Frontend SHALL mark `tailwind.config.ts` as documentation/reference only and SHALL treat `globals.css` as the active source of tokens.

---

### Requirement 4 — Lot 0 : Alignement de la version Node

**User Story:** En tant que développeur, je veux que la version Node soit alignée entre `.nvmrc`, `engines` et le runtime d'exécution, afin d'éviter des incohérences entre les outils.

#### Acceptance Criteria

1. THE Monorepo `.nvmrc` SHALL declare a single Node.js major version.
2. THE root `package.json` `engines.node` field SHALL match the version declared in `.nvmrc`.
3. IF a CI or runtime configuration pins a Node version, THEN THAT pinned version SHALL match the `.nvmrc` version.

---

### Requirement 5 — Lot 0 : Configuration des rewrites Next.js (frontend→backend)

**User Story:** En tant que développeur, je veux que le frontend communique avec le backend en same-origin via les rewrites Next.js, afin que le cookie de session httpOnly soit posé et lu sans CORS avec credentials.

#### Acceptance Criteria

1. THE Frontend `next.config.ts` SHALL declare a rewrite rule that forwards requests matching `/api/v1/*` to the Backend base URL.
2. THE Backend base URL used by the rewrite SHALL be read from a Frontend environment variable and SHALL NOT be hard-coded in `next.config.ts`.
3. THE Frontend SHALL read its backend-related environment variables from `apps/frontend/.env.local` and SHALL NOT rely on cross-origin credentials.
4. WHEN the Frontend makes a request to `/api/v1/health`, THE request SHALL be proxied to the Backend and SHALL return HTTP 200.

---

### Requirement 6 — Lot 0 : Installation de lucide-react

**User Story:** En tant que développeur, je veux que `lucide-react` soit installé, afin que les icônes de linterface proviennent exclusivement de Lucide.

#### Acceptance Criteria

1. THE Frontend `package.json` SHALL declare `lucide-react` as a dependency with a pinned or caret-bounded version.
2. WHEN a Frontend screen renders an icon, THE Frontend SHALL import that icon from `lucide-react` and SHALL NOT use emoji or any other icon library.

---

### Requirement 7 — Lot 0 : Prisma en devDependencies et nettoyage du docker-compose

**User Story:** En tant que développeur, je veux que Prisma soit en devDependencies et que le `docker-compose.yml` soit nettoyé, afin que les dépendances de production soient correctement séparées et que la configuration Docker soit valide.

#### Acceptance Criteria

1. THE Backend `package.json` SHALL declare `prisma` as a `devDependency` while keeping `@prisma/client` as a runtime dependency.
2. THE `docker-compose.yml` SHALL NOT contain a top-level `version` key.
3. WHEN `docker compose up -d` is executed, THE PostgreSQL service SHALL start and accept connections on port 5432 using the credentials supplied in `.env`.

---

### Requirement 8 — Lot 0 : Redirection de la page d'accueil

**User Story:** En tant qu'utilisateur, je veux que la page d'accueil `/` me redirige vers le dashboard ou la page de connexion, afin que je ne reste jamais sur une page d'accueil vide.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to `/`, THE Frontend SHALL redirect the user to `/login`.
2. WHEN an authenticated user navigates to `/`, THE Frontend SHALL redirect the user to `/dashboard`.
3. THE Frontend SHALL NOT render a standalone home page with default Next.js content at `/`.

---

### Requirement 9 — Étape 1.1 : Endpoints d'authentification locale (backend)

**User Story:** En tant qu'utilisateur, je veux me connecter et me déconnecter avec un identifiant et un mot de passe locaux, afin d'accéder de façon sécurisée à l'application.

#### Acceptance Criteria

1. THE Backend SHALL expose `POST /api/v1/auth/login` accepting a JSON body with `username` and `password`.
2. THE Backend SHALL expose `POST /api/v1/auth/logout` that revokes the current Session of the authenticated user.
3. THE Backend SHALL expose `GET /api/v1/auth/me` that returns the authenticated user's profile and MVP 1 Roles.
4. THE Backend SHALL validate every authentication DTO with `class-validator` using `whitelist: true` and `forbidNonWhelisted: true`.
5. IF `POST /auth/login` receives a request for a `User` whose `status` equals `LOCKED`, THEN THE Backend SHALL reject the request with the Generic Error Message without checking the password.

---

### Requirement 10 — Étape 1.1 : Hash des mots de passe et verrouillage de compte

**User Story:** En tant qu'administrateur sécurité, je veux que les mots de passe soient hashés avec argon2 et que les comptes soient verrouillés après des échecs répétés, afin de limiter les attaques par force brute.

#### Acceptance Criteria

1. THE Backend SHALL hash every local password with `argon2` before storage and SHALL verify submitted passwords with `argon2`'s verify function.
2. IF a login attempt fails because the credentials are invalid, THEN THE Backend SHALL increment the `failedLoginCount` of the matching `User` and create an `AuthEvent` with `eventType` `LOGIN_FAILED`.
3. IF the `failedLoginCount` of a `User` reaches 5, THEN THE Backend SHALL set that `User`'s `status` to `LOCKED` and create an `AuthEvent` with `eventType` `ACCOUNT_LOCKED`.
4. WHEN a login attempt succeeds, THE Backend SHALL reset the `failedLoginCount` to 0, set `lastLoginAt` to the current time, and create an `AuthEvent` with `eventType` `LOGIN_SUCCESS`.
5. THE Backend SHALL return the Generic Error Message for any failed local login, regardless of whether the failure is due to an unknown username or an invalid password.

---

### Requirement 11 — Étape 1.1 : Sessions serveur et cookie de session

**User Story:** En tant qu'utilisateur, je veux que ma session soit stockée côté serveur avec un cookie httpOnly, afin que mon jeton ne soit pas accessible au JavaScript du navigateur.

#### Acceptance Criteria

1. WHEN a local login succeeds, THE Backend SHALL create a `Session` with a `sessionTokenHash` (the hash of the generated Session Token), an `ipAddress`, a `userAgent`, and an `expiresAt` set to 8 hours after creation.
2. THE Backend SHALL store the Session Token only as a hash in `sessionTokenHash` and SHALL transmit the unhashed Session Token to the client exclusively via the Session Cookie.
3. THE Backend SHALL set the Session Cookie with the attributes `httpOnly`, `secure`, and `sameSite=strict`.
4. WHEN a protected request is received, THE Backend SHALL hash the Session Token from the cookie, look up the matching `Session`, and reject the request with HTTP 401 if the `Session` is revoked (`revokedAt` is not null) or expired (`expiresAt` has passed).
5. WHEN `POST /auth/logout` is called by an authenticated user, THE Backend SHALL set `revokedAt` to the current time on the current `Session` and create an `AuthEvent` with `eventType` `LOGOUT`.
6. WHILE a `User` is authenticated, THE Backend SHALL load that `User`'s MVP 1 Roles and their `Permission` list into the request context.

---

### Requirement 12 — Étape 1.1 : Rate limiting sur la connexion

**User Story:** En tant qu'administrateur sécurité, je veux que le endpoint de connexion soit limité en tentatives par adresse IP, afin de limiter les attaques par force brute au niveau du réseau.

#### Acceptance Criteria

1. THE Backend SHALL apply Rate Limiting of 5 attempts per 15-minute sliding window per source IP address on `POST /auth/login`.
2. IF the rate limit is exceeded for a given source IP, THEN THE Backend SHALL reject further login attempts from that IP with an HTTP 429 status until the window resets.
3. THE Rate Limiting on `/auth/login` SHALL operate independently of the Account Lockout mechanism, so that an IP rate-limited does not bypass per-user lockout and vice versa.

---

### Requirement 13 — Étape 1.1 : Écran de connexion frontend

**User Story:** En tant qu'utilisateur, je veux un écran de connexion professionnel qui gère le cookie de session et me redirige après connexion, afin d'accéder à l'application de façon fluide.

#### Acceptance Criteria

1. THE Frontend SHALL expose a `/login` route containing a form with an identifier field, a password field, and a submit action.
2. THE Frontend SHALL submit the login form to `/api/v1/auth/login` and SHALL manage the Session Cookie transparently (no manual token handling in client code).
3. WHEN a login attempt fails, THE Frontend SHALL display the Generic Error Message and SHALL remain on `/login`.
4. WHEN a login attempt succeeds, THE Frontend SHALL redirect the user to `/dashboard`.
5. WHEN an already-authenticated user navigates to `/login`, THE Frontend SHALL redirect the user to `/dashboard`.
6. THE `/login` screen SHALL follow the GFEP Design System: customized shadcn/ui components, GFEP palette, Inter font loaded via `next/font`, and no default gray/slate theme.
7. THE `/login` screen SHALL display a link to the Active Directory login route `/login/ad`. WHILE the user is on `/login/ad` in MVP 1, THE Frontend SHALL render a "fonctionnalité indisponible" notice, since Active Directory authentication is out of scope for this lot.

---

### Requirement 14 — Étape 1.2 : RBAC basique — 3 rôles et permissions

**User Story:** En tant qu'administrateur, je veux que trois rôles et leurs permissions soient définis en base, afin que le contrôle d'accès repose sur des données et non sur du code en dur.

#### Acceptance Criteria

1. THE Backend SHALL define the MVP 1 Roles in the `roles` table: `SUPER_ADMIN`, `DEPARTMENT_MANAGER`, and `EMPLOYEE`, each with a `description`.
2. THE Backend SHALL define a `Permission` set as a subset covering the resources `employees`, `departments`, and `dashboard` with actions `read`, `write`, `delete` as applicable, stored in the `permissions` table with unique `(resource, action)` pairs.
3. THE Backend SHALL link each MVP 1 Role to its permissions via `RolePermission` rows, so that `SUPER_ADMIN` holds all permissions, `DEPARTMENT_MANAGER` holds read on all plus write restricted to its Department Manager Scope, and `EMPLOYEE` holds read on the dashboard and employees list only.
4. THE MVP 1 Roles and their permissions SHALL be created by the Seed MVP 1 and SHALL NOT be hard-coded in application logic.

---

### Requirement 15 — Étape 1.2 : Guards de rôle et de permission

**User Story:** En tant qu'administrateur sécurité, je veux que chaque endpoint sensible soit protégé par un guard de rôle et un guard de permission vérifiés côté serveur, afin que l'interface ne soit jamais la seule barrière d'autorisation.

#### Acceptance Criteria

1. THE Backend SHALL implement a Role Guard that verifies that at least one of the authenticated user's MVP 1 Roles matches a role declared via a `@Roles(...)` decorator on the handler or controller.
2. THE Backend SHALL implement a Permission Guard that verifies, via `Permission (resource, action)`, that the authenticated user holds the precise permission declared via a `@Permission(...)` decorator.
3. IF an authenticated user lacks the required role or permission for an endpoint, THEN THE Backend SHALL reject the request with HTTP 403.
4. THE Backend SHALL apply both the Role Guard and the Permission Guard on every sensitive endpoint introduced in MVP 1, so that role and permission are each checked.
5. WHERE a resource is subject to fine-grained ownership (e.g., an `Employee`), THE Backend SHALL additionally verify ownership or Department Manager Scope in the service layer, beyond the Role Guard and Permission Guard.

---

### Requirement 16 — Étape 1.3 : Module Dashboard — backend

**User Story:** En tant qu'utilisateur, je veux que le backend fournisse des indicateurs de base pour le dashboard, afin que mon écran affiche des données réelles.

#### Acceptance Criteria

1. THE Backend SHALL expose `GET /api/v1/dashboard` returning indicators adapted to the authenticated user's MVP 1 Role.
2. THE Backend SHALL compute the indicators from the database, including the total employee count and recent activity (empty for MVP 1).
3. WHERE the authenticated user is a `DEPARTMENT_MANAGER`, THE Backend SHALL scope the employee count and indicators to the manager's own department.
4. THE Backend SHALL protect `GET /api/v1/dashboard` with the Role Guard and Permission Guard, restricting access to authenticated users with the `dashboard:read` permission.

---

### Requirement 17 — Étape 1.3 : Module Dashboard — frontend

**User Story:** En tant qu'utilisateur, je veux un dashboard dont le contenu s'adapte à mon rôle, afin de voir les informations pertinentes pour moi.

#### Acceptance Criteria

1. THE Frontend SHALL expose a `/dashboard` route that fetches `/api/v1/dashboard` and renders indicator cards.
2. THE Frontend SHALL render different content for each MVP 1 Role: `EMPLOYEE` sees personal information and recent documents placeholders, `DEPARTMENT_MANAGER` sees team headcount and department indicators, and `SUPER_ADMIN` sees global headcount and indicators.
3. THE `/dashboard` SHALL follow the GFEP Design System including cards (Background Surface, 8px radius, subtle shadow), typography (Inter), and no default gray/slate theme.
4. THE `/dashboard` SHALL be accessible only to authenticated users; WHEN an unauthenticated user navigates to `/dashboard`, THE Frontend SHALL redirect the user to `/login`.

---

### Requirement 18 — Étape 1.4 : Module Employés — backend CRUD

**User Story:** En tant qu'utilisateur habilité, je veux lister, consulter, créer et modifier des employés via l'API, afin de gérer le personnel de l'entreprise.

#### Acceptance Criteria

1. THE Backend SHALL expose `GET /api/v1/employees` returning a paginated list of employees with Pagination (`?page=` and `?limit=`, default limit 25).
2. THE Backend SHALL expose `GET /api/v1/employees/:id` returning the detail of a single employee including department, position, and manager relations.
3. THE Backend SHALL expose `POST /api/v1/employees` creating a new employee from a validated DTO, generating a unique `employeeNumber`.
4. THE Backend SHALL expose `PATCH /api/v1/employees/:id` updating an existing employee from a validated DTO.
5. THE Backend SHALL validate every employee DTO with `class-validator` using `whitelist: true` and `forbidNonWhitelisted: true`.
6. WHEN an employee is created or updated, THE Backend SHALL enforce referential integrity on `departmentId`, `positionId`, and `managerId`.
7. WHEN an `Employee` is created or updated, THE Backend SHALL persist all data exclusively via Prisma parameterized queries and SHALL NOT execute raw SQL.

---

### Requirement 19 — Étape 1.4 : Module Employés — permissions

**User Story:** En tant qu'administrateur sécurité, je veux que la lecture des employés soit ouverte à tous les rôles authentifiés mais que l'écriture soit réservée aux rôles habilités dans leur périmètre, afin de respecter la hiérarchie organisationnelle.

#### Acceptance Criteria

1. THE Backend SHALL allow every authenticated MVP 1 Role to read the employee list and an employee detail (`employees:read`).
2. THE Backend SHALL allow `SUPER_ADMIN` and `DEPARTMENT_MANAGER` to create and update employees (`employees:write`), and SHALL deny `EMPLOYEE`.
3. WHERE the authenticated user is a `DEPARTMENT_MANAGER`, THE Backend SHALL restrict write operations to employees whose `departmentId` matches the manager's department (Department Manager Scope).
4. IF a `DEPARTMENT_MANAGER` attempts to write on an employee outside the manager's department, THEN THE Backend SHALL reject the request with HTTP 403.
5. THE Backend SHALL protect every employee endpoint with the Role Guard and the Permission Guard.

---

### Requirement 20 — Étape 1.4 : Module Employés — frontend

**User Story:** En tant qu'utilisateur, je veux des écrans de liste, de détail, de création et d'édition des employés, afin de gérer le personnel depuis l'interface.

#### Acceptance Criteria

1. THE Frontend SHALL expose `/employees` rendering a searchable, paginated table with filters by department and status.
2. THE Frontend SHALL expose `/employees/:id` rendering the employee detail with personal and professional information, department, position, and manager.
3. THE Frontend SHALL expose `/employees/new` and `/employees/:id/edit` rendering forms with client-side validation.
4. THE Frontend SHALL show create and edit actions only to `SUPER_ADMIN` and `DEPARTMENT_MANAGER`, and SHALL NOT show them to `EMPLOYEE`.
5. THE Frontend SHALL display loading (skeleton), empty, and error states on the employee list and detail screens, each with a contextual message and, for errors, a retry option.
6. THE employee screens SHALL follow the GFEP Design System including the Table component (sticky headers, 40px row height, hover state), forms with visible labels above fields, and error messages below fields.

---

### Requirement 21 — Étape 1.5 : Module Départements — backend

**User Story:** En tant qu'utilisateur, je veux lister et consulter les départements via l'API, afin de voir l'organisation de l'entreprise.

#### Acceptance Criteria

1. THE Backend SHALL expose `GET /api/v1/departments` returning the list of departments.
2. THE Backend SHALL expose `GET /api/v1/departments/:id` returning the detail of a department including its manager and its employees.
3. THE Backend SHALL compute each department's headcount from the `employees` table rather than storing a denormalized count.
4. THE Backend SHALL protect the department endpoints with the Role Guard and Permission Guard, allowing read (`departments:read`) for every authenticated MVP 1 Role.

---

### Requirement 22 — Étape 1.5 : Module Départements — frontend

**User Story:** En tant qu'utilisateur, je veux des écrans de liste et de détail des départements, afin de visualiser l'organisation et les effectifs réels.

#### Acceptance Criteria

1. THE Frontend SHALL expose `/departments` rendering the six departments as cards, each showing the manager and the real headcount.
2. THE Frontend SHALL expose `/departments/:id` rendering the department detail with its manager and the list of attached employees.
3. THE Frontend SHALL display loading (skeleton), empty, and error states on the department screens, each with a contextual message and, for errors, a retry option.
4. THE department screens SHALL follow the GFEP Design System including the Card component (Background Surface, 8px radius, subtle shadow), the GFEP palette, and Inter typography.

---

### Requirement 23 — Seed MVP 1

**User Story:** En tant que développeur, je veux un script de seed minimal dédié à MVP 1, afin de disposer de données cohérentes pour démontrer la connexion, le dashboard, les employés et les départements sans attendre le seed complet de MVP 2.

#### Acceptance Criteria

1. THE Backend SHALL provide a Seed MVP 1 script distinct from the MVP 2 full seed, executable via the Prisma seed command.
2. THE Seed MVP 1 SHALL create exactly 6 departments.
3. THE Seed MVP 1 SHALL create approximately 6 positions distributed across the departments.
4. THE Seed MVP 1 SHALL create approximately 5 employees assigned to the departments and positions.
5. THE Seed MVP 1 SHALL create the 3 MVP 1 Roles (`SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`) and a subset of `Permission` entries covering `employees`, `departments`, and `dashboard`.
6. THE Seed MVP 1 SHALL create `RolePermission` rows linking each role to its permissions, and `UserRole` rows linking the created users to their roles.
7. THE Seed MVP 1 SHALL create one `User` (local auth, `argon2`-hashed password) for each role, including at least one `SUPER_ADMIN`, one `DEPARTMENT_MANAGER`, and one `EMPLOYEE`, each linked to an `Employee` via `EmployeeIdentity`.
8. THE Seed MVP 1 SHALL create data in dependency order: `departments` → `positions` → `employees` → `users` → `roles`/`permissions` → `user_roles`/`role_permissions` → `employee_identities`.
9. WHEN the Seed MVP 1 is run against a migrated database, THE Seed MVP 1 SHALL complete without errors and leave the database populated at the MVP 1 volumes.

---

### Requirement 24 — Critères de passage et validation du lot

**User Story:** En tant que développeur, je veux que les critères de passage de chaque étape soient vérifiés concrètement avant de considérer le lot terminé, afin de ne pas bâtir la suite sur une base non validée.

#### Acceptance Criteria

1. WHEN `npm run lint` is executed from the Monorepo root, THE lint step SHALL pass for both the Backend (oxlint) and the Frontend (ESLint) after the Lot 0 cleanup.
2. WHEN a user created by the Seed MVP 1 logs in with valid credentials, THE login SHALL succeed, a Session SHALL be created with an 8-hour `expiresAt`, and the user SHALL be redirected to `/dashboard`.
3. IF a user submits invalid credentials 5 times, THEN THE account SHALL become `LOCKED` and subsequent login attempts SHALL be rejected with the Generic Error Message until the account is unlocked.
4. WHEN 5 login attempts originate from the same IP within 15 minutes, THE Backend SHALL return HTTP 429 on subsequent attempts from that IP.
5. IF an `EMPLOYEE` attempts to create an employee, THEN THE Backend SHALL return HTTP 403.
6. IF a `DEPARTMENT_MANAGER` attempts to update an employee outside the manager's department, THEN THE Backend SHALL return HTTP 403.
7. WHEN the `/departments` screen is opened, THE screen SHALL display the 6 departments each with a headcount matching the number of employees in the database.
8. IF any of the criteria above fails, THEN THE developer SHALL resolve the failure before considering the lot complete.

---

## Traçabilité

| Requirement | Source(s) de référence |
| --- | --- |
| 1 — Suppression code mort | Décision clarification #2/#8 ; `06-Implementation-Plan.md` Phase 0 nettoyage |
| 2 — Consolidation linters | Décision clarification #2 ; `02-TRD.md` §2 (Tests/lint) |
| 3 — Source unique Tailwind v4 | Décision par défaut #2 ; `04-UXUI-Design-System.md` §9 |
| 4 — Alignement version Node | Décision par défaut #3 ; `.nvmrc` Phase 0 |
| 5 — Rewrites Next.js | Décision par défaut #4 ; `02-TRD.md` §3 (règles d'architecture) |
| 6 — lucide-react | Décision par défaut #5 ; `04-UXUI-Design-System.md` §2.3 |
| 7 — Prisma devDeps / docker-compose | Décision par défaut #6 ; `06-Implementation-Plan.md` Étape 0.2 |
| 8 — Redirection page d'accueil | Décision par défaut #8 ; `03-AppFlow.md` §3.1/§3.3 |
| 9 — Endpoints auth locale | `05-Backend-Schema.md` §5.1 ; `06-Implementation-Plan.md` Étape 1.1 ; `02-TRD.md` §9 |
| 10 — Hash argon2 / verrouillage | `02-TRD.md` §6 ; `05-Backend-Schema.md` §5.1 ; `01-PRD.md` §4.1 |
| 11 — Sessions / cookie | `02-TRD.md` §6 ; `05-Backend-Schema.md` §5.3 ; Décision session 8h |
| 12 — Rate limiting | `02-TRD.md` §6 (5/15min) ; `01-PRD.md` §4.1 |
| 13 — Écran /login | `03-AppFlow.md` §3.1 ; `04-UXUI-Design-System.md` §2/§4 ; `01-PRD.md` §4.1 |
| 14 — 3 rôles / permissions | `06-Implementation-Plan.md` Étape 1.2 ; `05-Backend-Schema.md` §3 (Access Control) |
| 15 — Guards rôle/permission | `02-TRD.md` §6 ; `05-Backend-Schema.md` §5.4 ; `01-PRD.md` §4.7 |
| 16 — Dashboard backend | `06-Implementation-Plan.md` Étape 1.3 ; `03-AppFlow.md` §5 |
| 17 — Dashboard frontend | `03-AppFlow.md` §3.3/§5 ; `04-UXUI-Design-System.md` §4.3 |
| 18 — Employés backend CRUD | `06-Implementation-Plan.md` Étape 1.4 ; `05-Backend-Schema.md` §3 (Employee) ; `02-TRD.md` §9 |
| 19 — Employés permissions | `03-AppFlow.md` §3.4 ; `05-Backend-Schema.md` §5.4 ; `01-PRD.md` §4.3 |
| 20 — Employés frontend | `03-AppFlow.md` §3.4 ; `04-UXUI-Design-System.md` §4.2/§7 ; `03-AppFlow.md` §7 |
| 21 — Départements backend | `06-Implementation-Plan.md` Étape 1.5 ; `05-Backend-Schema.md` §3 (Department) |
| 22 — Départements frontend | `03-AppFlow.md` §3.5 ; `04-UXUI-Design-System.md` §4.3/§7 |
| 23 — Seed MVP 1 | Décision clarification #3 ; `05-Backend-Schema.md` §7 ; `06-Implementation-Plan.md` Étape 2.1 (distinct) |
| 24 — Critères de passage | `06-Implementation-Plan.md` critères de passage 1.1–1.5 |
