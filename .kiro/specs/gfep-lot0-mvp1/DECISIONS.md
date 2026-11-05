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

---

## Décisions consignées après l'audit MVP 1

### I13 — Décisions prises pendant l'implémentation, non documentées jusqu'ici (audit, section G)
- **Token `--color-link`** : rôle de couleur pour texte, icône et anneau de focus (liens, navigation active, logo). En clair `#0F4C3A` (primaire) ; en sombre `#D4AF37` (secondaire sombre), car le primaire sombre `#1A6B52` n'atteint que 2,8:1 sur la surface.
- **Badges** : texte en couleur de premier plan sur fond sémantique teinté, avec une pastille de la couleur sémantique. Le texte en couleur sémantique ne passait pas WCAG AA (ex. « Suspendu » 2,8:1).
- **Bordures des champs** : token `foreground-secondary` au lieu de `border` (1,25:1, sous le seuil 3:1 de WCAG 1.4.11).
- **Bouton destructif en mode sombre** : texte `#0D0F0E` (blanc sur `#E05A4A` = 3,66:1).
- **Vitest au lieu de Jest** (TRD §2) : choix hérité de la Phase 0 et conservé ; Supertest est utilisé comme prévu.
- **Script `test` racine** : `npm test` enchaîne backend puis frontend.
- **Liste des employés** : renvoie tous les statuts par défaut (filtre `status` disponible), alors que `design.md` §6.3 indiquait « employés actifs ».
- **Recherche** : multi-mots, chaque mot doit correspondre au prénom ou au nom (ET).
- **Codes d'erreur ajoutés** au tableau de `design.md` §10 : 409 pour un email professionnel en doublon, 400 pour « son propre responsable ».
- **Identifiant non UUID** : 400 (`ParseUUIDPipe`), pas 404.
- **Navigation mobile** : icônes dans la topbar ; le tiroir (drawer) et la sidebar réductible relèvent de l'étape 3.1.
- **Pas de `lib/auth/actions.ts`** (prévu par `design.md` §3.8) : le formulaire appelle `/api/v1/auth/login` via les rewrites.
- **Contradiction sur le verrouillage** entre PRD/AppFlow et `design.md` §10.2 : tranchée par I14 et I20.

### I14 — Verrouillage temporaire de 15 minutes
- Après 5 échecs, le compte passe `LOCKED` et un `AuthEvent ACCOUNT_LOCKED` est créé.
- Au premier essai de connexion survenant 15 minutes ou plus après le dernier `ACCOUNT_LOCKED`, le compte repasse `ACTIVE`, avec `failedLoginCount` remis à 0. L'essai est ensuite traité normalement : un mauvais mot de passe compte alors comme 1er échec.
- Aucun nouveau champ en base. Le schéma n'a pas de type d'événement « déverrouillage », donc il n'est pas journalisé.
- Un compte `LOCKED` sans événement `ACCOUNT_LOCKED` (verrou posé hors du flux de connexion) reste verrouillé.
- Pendant le verrou, la réponse est identique à un mauvais mot de passe : même 401 « Identifiants invalides. », même corps. Une vérification argon2 factice aligne le temps de réponse.
- Le déverrouillage manuel par un Super Admin est reporté à l'étape 2.4 (tâche T2.4.R2).

### I15 — Interdiction par défaut des routes
- `SessionGuard`, `RoleGuard` et `PermissionGuard` sont globaux (`APP_GUARD`, dans cet ordre) ; les contrôleurs n'utilisent plus `@UseGuards` pour l'autorisation.
- **Exceptions explicites** :
  - `@Public()`, réservé à `GET /health` et `POST /auth/login` ;
  - `@AuthenticatedOnly()`, pour les routes ouvertes à tout utilisateur connecté et limitées à ses propres données (`GET /auth/me`, `POST /auth/logout`). Sans cette exception, chaque nouveau rôle de l'étape 2.4 devrait être ajouté à ces routes.
- **Toute autre route** doit porter `@Roles()` ET `@Permission()`, sinon 403, même pour un Super Admin.
- `test/route-access.int-spec.ts` inventorie les routes (contrôle croisé avec le routeur Express) et échoue si une route est publique sans `@Public()` ou n'a pas de métadonnées d'autorisation.

### I16 — Numérotation `employeeNumber`
- Format `GF-{AAAA}-{NNN}` : plus grand suffixe numérique de l'année courante + 1. La numérotation repart à 001 chaque année ; les trous ne sont pas réutilisés.
- Calcul et insertion dans une même transaction. En cas de conflit d'unicité sur `employeeNumber` (créations simultanées), nouvel essai, jusqu'à 5 tentatives au total ; au-delà, 409 « Impossible d'attribuer un numéro d'employé. Réessayez. ».
- **Traduction de P2002** selon `meta.target` :
  - le message « email professionnel existe déjà » n'apparaît que si le conflit porte sur `professionalEmail` ;
  - tout autre conflit renvoie un message neutre.

### I17 — Erreurs 400 sans fuite (design.md §11, Property 1)
- Toute erreur de validation renvoie `{ statusCode: 400, error: "Bad Request", message: "Données invalides." }`, avec au plus `fields` : les champs **déclarés** du DTO en erreur. Un champ inconnu n'est jamais nommé, et le détail des contraintes n'est jamais renvoyé.
- **Filtre global** (`BadRequestFilter`) : tout autre 400 du framework (JSON mal formé, `ParseUUIDPipe`, etc.) est remplacé par la même réponse générique. Le JSON mal formé renvoyait auparavant le message du parseur (« Unexpected end of JSON input »).
- Les refus métier volontaires utilisent `BusinessRuleException` et gardent leur message en français destiné à l'utilisateur.
- Validation, pipe et filtre sont configurés dans `src/app.setup.ts` (`configureApp`), partagé par `main.ts` et les tests.

### I18 — `/design-system` absent en production
La page de référence interne renvoie 404 quand `NODE_ENV=production` (`app/design-system/layout.tsx`), conformément à `04-UXUI-Design-System.md` §9. Elle reste disponible avec `npm run dev`.

### I19 — Bouton « Suspendre » reporté à l'étape 2.4
Il reste affiché désactivé en MVP 1 (I10) et sera activé avec l'endpoint de changement de statut à l'étape 2.4 (tâche T2.4.R1, avec tests par rôle).

### I20 — Correction de PRD §4.1 et AppFlow §3.1
- Les deux documents annonçaient un message de verrouillage indiquant le délai d'attente, ce qui contredit la règle absolue du message générique (`design.md` §10.2, Req 10.5).
- Ils sont corrigés : verrouillage temporaire de 15 minutes, message générique, aucun délai affiché.

### I21 — Message de connexion en cas de panne
Le formulaire de connexion distingue :
- « Identifiants invalides. » : 401 ou 400 ;
- « Trop de tentatives… » : 429 ;
- « Service momentanément indisponible. Réessayez. » : erreur réseau ou 5xx.

Une panne du backend n'est donc plus présentée comme un échec d'identification.

### I22 — Tests e2e sur la base de test
`test/app.e2e-spec.ts` utilise l'application configurée par `configureApp` sur la base `_test` et fait partie de `npm test`. `npm run test:e2e` réutilise la même configuration, limitée aux specs e2e.
