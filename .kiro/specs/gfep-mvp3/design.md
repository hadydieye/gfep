# Design — MVP 3 (étapes 3.1 à 3.5)
## Guinea Finance Enterprise Portal (GFEP)

---

Ce document décrit la mise en œuvre des exigences de `requirements.md`. Les décisions de référence sont dans `DECISIONS.md` (N1–N30). Les conventions des MVP précédents (`gfep-lot0-mvp1/design.md`, `gfep-mvp2/design.md`) restent valables.

## 1. Conventions communes

- **Backend :** NestJS 12 en ESM, guards globaux (I15), `configureApp` partagé entre `main.ts` et les tests (I17), `BusinessRuleException` pour les refus métier, audit dans la transaction de l'action (M12).
- **Frontend :** Next.js 15 (App Router), données chargées côté serveur par `apiGet`, actions côté client par `apiFetch` via les rewrites (D4), composants `ui/` personnalisés, états `states.tsx`.
- **Tests :** Vitest + Supertest sur la base `_test` (I12), exécution séquentielle ; Vitest + Testing Library + jsdom côté frontend.
- **Permissions :** 30 → 34 en 3.2 (N29). Rôles par constantes existantes (`ALL_ROLES`, `READ_ROLES`, `FINANCE_*`, etc.) ; nouvelles constantes `PROFILE_ROLES` (= `ALL_ROLES`) et `SETTINGS_ROLES` (`[SUPER_ADMIN]`).

---

## 2. Matrice d'accès des routes nouvelles ou modifiées

| Route | Permission | Rôles | Étape |
|---|---|---|---|
| `GET /employees`, `/documents`, `/transactions`, `/invoices`, `/access/users`, `/audit/*` (+ `sort`, `order`) | inchangée | inchangés | 3.1 |
| `GET /documents` (+ `ownerId`, `departmentId`) | `documents:read` | inchangés | 3.1 |
| `GET /transactions/export` | `transactions:read` | SA, ACC, DM (scope) | 3.1 |
| `GET /invoices/export` | `invoices:read` | SA, ACC, DM (scope) | 3.1 |
| `GET /dashboard` (SA enrichi) | `dashboard:read` | inchangés | 3.1 |
| `GET /profile` | `profile:read` | 8 rôles | 3.2 |
| `PATCH /profile/password` | `profile:update` | 8 rôles | 3.2 |
| `GET /admin/settings` | `settings:read` | SA | 3.2 |
| `PATCH /admin/settings` | `settings:write` | SA | 3.2 |
| `GET /api/docs`, `/api/docs-json` | hors routeur Nest, développement uniquement | — | 3.5 |

---

## 3. Étape 3.1 — Finition UI/UX

### 3.1 Revue des écrans
Grille écran × règle de `04` §3–§8 (palette, typographie, espacements, tableaux, cartes, formulaires, modales, toasts, badges, états vides et de chargement, clair/sombre, responsive), tenue dans les notes de T3.1.1 puis résumée dans `PROGRESS.md`. Tout écart trouvé est corrigé dans une tâche de 3.1 ; un écart qui ne relève d'aucune règle écrite fait l'objet d'une question.

### 3.2 Tri côté serveur (N6)
Utilitaire commun `src/common/sorting.ts` :
- `SortQuery` : `sort?: string` (validé par `@IsIn(whitelist)` dans chaque DTO), `order?: 'asc' | 'desc'` (`@IsIn`, défaut `asc`) ;
- `buildOrderBy(sort, order, map, tiebreaker)` : traduit une clé publique en `orderBy` Prisma (y compris relation, ex. `department.name`) et ajoute la clé de départage.

| Endpoint | Clés `sort` | Départage | Défaut actuel (inchangé) |
|---|---|---|---|
| `GET /employees` | `lastName`, `employeeNumber`, `department`, `position`, `hireDate`, `status` | `id` | `lastName`, `firstName` |
| `GET /documents` | `title`, `category`, `confidentiality`, `validationStatus`, `createdAt` | `id` | `createdAt desc` |
| `GET /transactions` | `reference`, `type`, `amount`, `status`, `department`, `createdAt` | `reference` | `createdAt desc`, `reference desc` |
| `GET /invoices` | `invoiceNumber`, `clientName`, `amount`, `dueDate`, `status`, `department` | `invoiceNumber` | `dueDate desc`, `invoiceNumber desc` |
| `GET /access/users` | `username`, `status`, `authProvider`, `lastLoginAt`, `createdAt` | `id` | `username` |
| `GET /audit/logs` | `timestamp`, `action`, `actor` | `id` | `timestamp desc`, `id desc` |
| `GET /audit/security-events` | `timestamp`, `eventType`, `severity` | `id` | `timestamp desc`, `id desc` |
| `GET /audit/auth-events` | `timestamp`, `eventType`, `user` | `id` | `timestamp desc` |

Les colonnes exactes de chaque tableau sont confrontées à cette liste au moment de T3.1.4 : une colonne affichée non triable reste non cliquable.

**Frontend :** composant `ui/sortable-header.tsx` (bouton dans `<th>`, `aria-sort`, `ArrowUp` / `ArrowDown` / `ArrowUpDown` en 16 px) ; hook `useListParams` qui lit et écrit `sort`, `order`, `page` dans l'URL. Tri client sur `/departments/[id]` : même en-tête, état local.

### 3.3 Export CSV (N5)
- `src/finance/csv.ts` : `toCsv(headers, rows)` (BOM, `;`, CRLF, RFC 4180), `neutralizeFormula(value)`, `formatDecimalFr(decimalString)` (manipulation de chaîne), `formatDateIso(date)`.
- `TransactionsService.export(user, query)` / `InvoicesService.export(user, query)` réutilisent la construction du `where` de la liste (scope DM compris) et `buildOrderBy` ; `count` d'abord : > 10 000 → 400 ; sinon `findMany` sans pagination.
- Les DTO d'export = DTO de liste sans `page`/`limit` (`OmitType`).
- Contrôleur : `@Get('export')` déclaré **avant** `@Get(':id')`, `@Header` CSV, `StreamableFile` / `res.send` d'un `Buffer`.
- Audit `transaction.export` / `invoice.export`, `resourceId: 'export'`, `newValues: { filters, rows }`.
- Colonnes transactions : Référence, Type, Montant, Devise, Statut, Département, Description, Créée le. Factures : Numéro, Client, Montant, Devise, Échéance, Statut, Département, Créée le. Libellés de type et de statut en français (mêmes libellés que l'interface).
- **Frontend :** bouton secondaire « Exporter » (icône `Download`) dans la barre de filtres. Au clic, `fetch` same-origin de `/api/v1/…/export?<filtres et tri courants>` (cookie de session) en `blob` ; état de chargement sur le bouton ; en cas de 400 (plafond), toast d'erreur avec le message métier ; sinon téléchargement par un lien temporaire (`URL.createObjectURL`, nom repris de `Content-Disposition`) et toast de succès « Export téléchargé ».

### 3.4 Toasts (N12)
- `ui/sonner.tsx` : `visibleToasts={2}`, `closeButton`, `duration: Infinity` pour `toast.error`.
- Toast après redirection : émis juste avant `router.push` ; le `Toaster` du layout racine survit à la navigation côté client (voir N31, qui remplace le relais `sessionStorage` initialement prévu).
- Inventaire des actions d'écriture (T3.1.6) : création et modification d'employé (manquants), et vérification des autres (statut employé, documents, finance, accès, mappings AD, notifications).

### 3.5 Navigation responsive (N7)
- `layout/app-shell.tsx` (client) : état `collapsed` (préférence `localStorage` `gfep-sidebar`, défaut : réduit si largeur < 1280 px au montage), état `drawerOpen`.
- `Sidebar` reçoit `collapsed` : largeur `w-[260px]` ou `w-16`, libellés masqués visuellement mais conservés comme nom accessible (`aria-label`, `title`) ; bouton de réduction (`PanelLeftClose` / `PanelLeftOpen`) en pied de sidebar. Sous-menus Finance et Accès : en mode icônes, l'icône du groupe pointe vers le premier sous-lien accessible (comportement mobile actuel, M30).
- `MobileNav` : bouton `Menu` dans la topbar (< 768 px), panneau `ui/sheet.tsx` (dialog latéral : `role="dialog"`, `aria-modal`, piège à focus, Échap, clic sur le voile, fermeture à chaque changement de `pathname`).
- Le contenu principal suit la largeur (`md:pl-16` / `xl:pl-[260px]` selon l'état).

### 3.6 Thème (N8)
- `lib/theme.ts` : `THEME_COOKIE = 'gfep-theme'`, `readTheme(cookies)` (serveur), `setTheme(theme)` (client : `document.cookie`, bascule de la classe `dark`).
- `app/layout.tsx` lit le cookie via `cookies()` et rend `<html className={theme === 'dark' ? 'dark' : undefined}>`.
- `layout/theme-toggle.tsx` : bouton icône (`Sun` / `Moon`), `aria-label` « Activer le thème sombre » / « Activer le thème clair », `aria-pressed`.
- `/design-system` : suppression de la logique `localStorage`, réutilisation du contrôle.

### 3.7 Ombres et test anti-couleurs (N9)
- `globals.css` : `--shadow-card` dans `@theme` ; réassignation sous `.dark`.
- `src/test/design-tokens.test.ts` : lecture récursive de `src/` (Node `fs`), motifs interdits de N9, rapport des fichiers et lignes fautifs.

### 3.8 Dashboard SUPER_ADMIN (N10)
- `DashboardService.getIndicators` : pour SA, ajoute `accountantCards()`, `pendingDocuments` tous départements (+ `pendingDocumentsTotal`), `hrCards()`, `securityAlerts` et `recentSecurityEvents` (méthodes existantes réutilisées).
- `DashboardResponseDto` : ajout de `pendingDocumentsTotal?: number` ; commentaires de rôles mis à jour.
- Frontend `AdminCards` : grille 12 colonnes (`04` §3) — ligne 1 indicateurs (effectif, recettes, dépenses, factures en attente), puis répartition, documents en attente, alertes de sécurité, événements récents, comptes récents, activité, état des services, accès rapides. Composants de carte existants réutilisés.

### 3.9 Fiche employé et département (N11)
- `ListDocumentsQueryDto` : `ownerId?` et `departmentId?` (`@IsUUID`). `departmentId` filtre sur le département M8 (`category.departmentId`, à défaut `owner.departmentId`), combiné en `AND` avec le `where` de visibilité M9.
- `/employees/[id]` : sections « Documents liés » (5 plus récents + lien vers `/documents?ownerId=`) et « Historique » (10 dernières entrées `employee.*`, libellés d'action d'`audit-labels.tsx`), chargées côté serveur, chacune avec ses états.
- `/departments/[id]` : section « Ressources documentaires » (10 plus récents + lien vers `/documents?departmentId=`).
- `/documents` accepte ces deux paramètres dans l'URL et les affiche comme filtres actifs retirables.

### 3.10 `/finance`
`app/(auth)/finance/page.tsx` : `redirect('/finance/transactions')` côté serveur. Un utilisateur sans `transactions:read` reçoit l'état 403 de la page cible.

### 3.11 Tests (3.1)
- **Backend :** `test/sorting.int-spec.ts` (chaque clé de chaque endpoint, `asc`/`desc`, valeur invalide → 400, scope DM et M9 conservés, ordre par défaut inchangé) ; `test/finance-export.int-spec.ts` (8 rôles + 401, scope DM, filtres, BOM, séparateur, CRLF, décimales, injection neutralisée, plafond 10 000 → 400 via un seuil injectable en test, audit sans données) ; `documents` (filtres `ownerId`, `departmentId` + M9) ; `modules` / `roles-matrix` (dashboard SA enrichi).
- **Frontend :** `design-tokens.test.ts`, tri (`sortable-header`), export (bouton, erreur 400), sidebar réduite et tiroir (clavier, Échap, focus), bascule de thème (cookie, classe), flash toast, dashboard SA, sections de fiche employé et département, redirection `/finance`.
- **Critère :** script de contrôle sur l'application compilée (backend + frontend en mode production, base de dev) : chaque route de page d'AppFlow §2 (hors `/profile`, `/admin/settings`) demandée pour chaque rôle concerné → 200 (ou redirection attendue), aucune 404.

---

## 4. Étape 3.2 — Profil et paramètres

### 4.1 Lien « Mot de passe oublié » (N13)
`login-form.tsx` : bouton lien sous le formulaire ; au clic, une zone `role="status"` affiche le message de N13. Aucun appel réseau.

### 4.2 Module `profile/`
- `ProfileController` (`@Controller('profile')`) : `GET /` et `PATCH /password` (`@UseGuards(ThrottlerGuard)`, `@Throttle({ 'password-change': … })`, `@SkipThrottle` pour `login` et `login-ad`). Les routes `login` et `login-ad` ajoutent `@SkipThrottle({ 'password-change': true })`.
- `UserThrottlerGuard` (extension de `ThrottlerGuard`) : `getTracker` = identifiant du compte pour `password-change`.
- `ProfileService.changePassword(user, dto, sourceIp, currentSessionId)` :
  1. compte AD → 409 ;
  2. `argon2.verify` du mot de passe actuel → 400 si faux ;
  3. `PasswordPolicy.check(newPassword, { current, username, firstName, lastName })` → 400 avec message ;
  4. transaction : `user.update(passwordHash)`, `session.updateMany(revokedAt)` sauf la session courante, audit, notification `SECURITY`.
- `src/auth/password-policy.ts` + `common-passwords.ts` (liste embarquée, quelques centaines d'entrées, comparaison insensible à la casse) ; normalisation NFD sans diacritiques pour la recherche de l'identifiant et du nom.
- `SessionMiddleware` expose l'identifiant de la session courante (`request.sessionId`) pour l'exclure de la révocation.

### 4.3 Paramètres système (N16)
- Migration `system_settings` :
  ```prisma
  model SystemSetting {
    key         String   @id
    value       Json
    updatedAt   DateTime @updatedAt
    updatedById String?
    updatedBy   User?    @relation("SettingUpdater", fields: [updatedById], references: [id])
    @@map("system_settings")
  }
  ```
  (relation inverse `settingsUpdated SystemSetting[] @relation("SettingUpdater")` sur `User`, sans colonne en base).
- `SettingsService` : `getSessionTtlHours()` (ligne `session.ttlHours` ou 8), `effectiveConfiguration()` (constantes existantes : `MAX_FAILED_LOGINS`, `LOCK_DURATION_MS`, throttlers, taille et formats M10, `AdStatusService`, version du `package.json`), `update(dto, actor, ip)` (transaction : upsert + audit `setting.update`).
- `AuthService.openSession` (local et AD) lit la durée via `SettingsService` ; `setSessionCookie` reçoit le `maxAge` correspondant.
- DTO `UpdateSettingsDto { sessionTtlHours: number }` (`@IsInt`, `@Min(1)`, `@Max(12)`).
- Seed : permissions `profile:*` (8 rôles) et `settings:*` (SA), 34 au total ; liaisons recalculées ; test du seed mis à jour.

### 4.4 Frontend
- `/profile` : carte « Mes informations » (définitions en grille), carte « Mot de passe » (formulaire React Hook Form + Zod : actuel, nouveau, confirmation, règles affichées sous le champ, validation en temps réel après la première soumission, `04` §4.4), carte « Apparence » (contrôle de N8). Lien depuis le nom de l'utilisateur dans la topbar (icône `UserRound`).
- `/admin/settings` : carte « Session » (champ numérique 1–12, bouton primaire « Enregistrer », toast), carte « Configuration effective » (lecture seule). Entrée « Paramètres » (`Settings`) dans la navigation pour `settings:read`. `/admin` continue de rediriger vers `/admin/audit` pour qui a `audit:read`, sinon vers `/admin/settings`.

### 4.5 Tests (3.2)
- `test/profile.int-spec.ts` : 8 rôles + 401 sur les deux routes ; données propres uniquement ; chaque règle de politique ; mot de passe actuel faux sans incrément de `failedLoginCount` ; compte AD → 409 ; 429 au 6e essai ; succès : ancienne connexion refusée, nouvelle acceptée, autres sessions révoquées, courante conservée, audit sans secret, notification `SECURITY`.
- `test/settings.int-spec.ts` : 8 rôles + 401 ; bornes 0 / 13 / non entier → 400 ; durée appliquée aux nouvelles sessions (expiration et `Max-Age` du cookie), sessions existantes inchangées ; audit `setting.update`.
- `seed.int-spec.ts`, `roles-matrix.int-spec.ts`, `route-access.int-spec.ts` mis à jour.
- Frontend : lien « Mot de passe oublié », formulaire de mot de passe (règles, erreurs, section absente pour AD), écran des paramètres, entrée de navigation.

---

## 5. Étape 3.3 — Durcissement sécurité

### 5.1 Pino (N17)
- `LoggerModule.forRoot({ pinoHttp: { genReqId, customProps, redact, level, stream } })` ; `main.ts` : `bufferLogs: true`, `app.useLogger(app.get(Logger))`. `genReqId` crée l'UUID et pose `X-Request-Id` sur la réponse.
- `stream` : `pino.multistream` (stdout + `pino.destination({ dest: LOG_FILE, mkdir: true })` si défini).
- `EventLogService.emit(kind, payload)` : écrit la ligne TRD §7.
- **Émission après commit :** `PrismaService` encapsule `$transaction` interactive dans un `AsyncLocalStorage` portant une file d'événements ; une extension Prisma (`$extends`, hook `create` sur `auditLog`, `authEvent`, `securityEvent`) ajoute l'événement à la file si une transaction est en cours, sinon l'émet aussitôt ; la file est vidée à la résolution de `$transaction` et abandonnée en cas d'échec. Si cette approche se heurte au typage ou au comportement de Prisma 5, l'agent s'arrête et pose la question avant d'en changer.

### 5.2 Compteurs persistants (N18)
- Migration `request_counters` :
  ```prisma
  model RequestCounter {
    id         String   @id @default(uuid())
    scope      String
    key        String
    occurredAt DateTime @default(now())
    expiresAt  DateTime
    @@index([scope, key, occurredAt])
    @@index([expiresAt])
    @@map("request_counters")
  }
  ```
- `PrismaThrottlerStorage implements ThrottlerStorage` : `increment(key, ttl, limit, blockDuration, throttlerName)` → transaction : purge des lignes expirées, insertion, comptage dans la fenêtre, calcul de `timeToExpire`, `isBlocked`, `timeToBlockExpire`. Fourni via `ThrottlerModule.forRootAsync({ storage })`.
- `ForbiddenCounter` réécrit sur la table (portée `forbidden`) ; la dernière émission est lue dans `security_events` (`eventType = repeated_forbidden`, `metadata.userId`).

### 5.3 En-têtes (N19)
- Backend : `app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }))` dans `configureApp` ; surcharge `frame-ancestors 'self'` et `X-Frame-Options: SAMEORIGIN` sur `/documents/:id/preview`.
- Frontend : `src/middleware.ts` génère le nonce, pose `Content-Security-Policy` sur la réponse et `x-nonce` sur la requête ; `next.config.ts` `headers()` pour les en-têtes statiques. Contrôle : chargement de chaque écran sans violation CSP dans la console (validation manuelle) et test automatisé de présence des en-têtes.

### 5.4 Revue OWASP (N20)
Structure de `OWASP-REVIEW.md` : méthode, périmètre, une section par catégorie A01–A10 (contrôles attendus, constat par module, preuve, écart, correction et test), risques acceptés, conclusion pour le critère.

### 5.5 Dépendances (N4, N21, N22)
Commandes et résultats (`npm audit`, `npm ls`) consignés dans `OWASP-REVIEW.md` (A06) ; évaluation `ldapts` dans une branche de travail locale, résultat consigné dans `DECISIONS.md`.

### 5.6 Tests (3.3)
- `test/logging.int-spec.ts` : `X-Request-Id` présent et unique ; en-tête client ignoré ; ligne TRD §7 émise après commit et absente après annulation ; aucune occurrence de mot de passe, cookie ou jeton dans les logs capturés (connexion, changement de mot de passe).
- `test/persistent-counters.int-spec.ts` : rate limiting et `repeated_forbidden` conservés après fermeture et recréation de l'application ; aucune IP en clair dans `request_counters`.
- `test/security-headers.int-spec.ts` : en-têtes helmet, exception de l'aperçu.
- Frontend : en-têtes et CSP du middleware (test unitaire du générateur de politique).

---

## 6. Étape 3.4 — Tests automatisés

- `.github/workflows/ci.yml` (N23) : `actions/checkout`, `actions/setup-node` (version de `.nvmrc`, cache npm), service `postgres:16` avec healthcheck, `DATABASE_URL` de test, `npm ci`, `npx prisma generate`, `npm run lint`, `npm run build`, `npm test`, `npm run test:cov -w apps/backend`.
- `typecheck` (N24) : backend `tsc --noEmit -p tsconfig.json` ; frontend `tsc --noEmit` ; `lint` = linter existant puis `typecheck`.
- Verrou (N25) : `global-setup.ts` ouvre un client `pg` dédié (via `PrismaClient` sur la base de test), `pg_try_advisory_lock(<constante>)` ; échec → exception avec le message de N25 ; le `teardown` libère le verrou et ferme la connexion.
- Couverture (N27) : `vitest.config.ts` `coverage.include` et `thresholds` ; tests ajoutés là où les seuils ne sont pas atteints.
- Frontend (N26) : tests de rendu et de navigation listés, avec données simulées de `apiFetch` / `apiGet`.

---

## 7. Étape 3.5 — Documentation API

- `@nestjs/swagger` + plugin CLI dans `nest-cli.json` (`classValidatorShim`, `introspectComments`).
- `src/swagger.ts` : `setupSwagger(app)` appelé par `main.ts` seulement si `NODE_ENV === 'development'` ; `DocumentBuilder` (titre, version, `addCookieAuth(SESSION_COOKIE_NAME)`) ; parcours des routes pour ajouter à chaque opération une description « Rôles : … — Permission : resource:action » depuis les métadonnées `ROLES_KEY` / `PERMISSION_KEY` / `IS_PUBLIC_KEY` / `AUTHENTICATED_ONLY_KEY`, et les réponses d'erreur standard.
- Réponses : `@ApiOkResponse` / `@ApiCreatedResponse` avec les DTO de réponse existants ; export CSV en `text/csv` ; téléchargements en binaire.
- CSP assouplie pour `/api/docs` uniquement (N19).
- Tests : `test/openapi.int-spec.ts` construit le document comme `setupSwagger` (sans monter l'UI) et compare à l'inventaire de `route-access` ; `NODE_ENV=production` → `/api/docs` 404.

---

## 8. Gestion des erreurs (compléments)

| Situation | Code | Message |
|---|---|---|
| `sort` / `order` hors liste blanche | 400 | « Données invalides. » |
| Export > 10 000 lignes | 400 | « L'export dépasse 10 000 lignes. Affinez les filtres. » |
| Mot de passe actuel incorrect | 400 | « Mot de passe actuel incorrect. » |
| Politique de mot de passe | 400 | message précis par règle (longueur, identique, identifiant ou nom, trop courant) |
| Changement de mot de passe d'un compte AD | 409 | « Le mot de passe d'un compte d'entreprise se gère dans l'annuaire. » |
| Trop d'essais de changement de mot de passe | 429 | « Trop de tentatives. Réessayez dans quelques minutes. » |
| Durée de session hors bornes | 400 | « Données invalides. » |
