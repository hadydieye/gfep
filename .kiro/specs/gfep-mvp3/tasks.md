# Plan d'implémentation — MVP 3 (étapes 3.1 à 3.5)
## Guinea Finance Enterprise Portal (GFEP)

---

## Vue d'ensemble

Le plan suit l'ordre exact de `06-Implementation-Plan.md`. Une étape ne commence qu'après l'accord explicite de l'utilisateur et la vérification du critère de la précédente.

**Notations :**
- `→ R`, `→ T` : exigences de `requirements.md` ;
- `→ N` : décisions de `DECISIONS.md`.

**Règles valables pour chaque étape :**
- tâche 0 : `docker ps` (`gfep_postgres` healthy), `npm run lint`, `npm run build`, `npm test` verts, sinon arrêt ;
- aucune route sans `@Roles` + `@Permission` ; aucune nouvelle route `@Public()` ;
- une migration = une tâche, avec mise à jour de `05`, de `schema.spec.ts` et de `DECISIONS.md` ;
- tests d'accès par rôle (8 rôles + 401) pour toute route ajoutée ou modifiée ;
- résultats réels de lint, build et test collés dans le rapport d'étape ; `PROGRESS.md` mis à jour ;
- les cases « validation manuelle utilisateur » ne sont **jamais** cochées par l'agent ;
- commit unique de l'étape après la validation manuelle, `git status` vérifié ; aucun push sans demande ;
- arrêt à la fin de l'étape, sans enchaîner.

---

## Étape 3.1 — Passe de finition UI/UX

- [x] T3.1.0 — Vérifications de départ
  - `docker ps`, `npm run lint`, `npm run build`, `npm test` ; arrêt si un seul est rouge.
  - _→ T6.1_
- [x] T3.1.1 — Revue écran par écran contre `04` §3–§8
  - Grille écran × règle pour chaque écran d'AppFlow §2 (hors `/profile`, `/admin/settings`) ; liste des écarts ; tout écart sans règle écrite → question.
  - _→ R1.4, N3_
- [x] T3.1.2 — Corrections immédiates actées
  - `/finance` → redirection vers `/finance/transactions`.
  - Typage de `test/documents.int-spec.ts:228`.
  - Délai explicite de 30 s pour le test de propriété de `design-system.test.tsx`.
  - _→ R1.2, R10, N12_
- [x] T3.1.3 — Token d'ombre et test anti-couleurs
  - `--shadow-card` clair et sombre ; remplacement des 7 occurrences ; `src/test/design-tokens.test.ts`.
  - _→ R2, N9_
- [x] T3.1.4 — Tri côté serveur
  - `src/common/sorting.ts` ; `sort`/`order` sur employés, documents, transactions, factures, comptes, audit (3 listes) ; listes blanches de design §3.2.
  - `test/sorting.int-spec.ts`.
  - _→ R3.1, R3.2, N6_
- [x] T3.1.5 — Tri côté interface
  - `ui/sortable-header.tsx`, hook `useListParams` ; branchement sur les 8 tableaux ; tri client du tableau de `/departments/[id]` ; tests frontend.
  - _→ R3.3, R3.4, N6_
- [x] T3.1.6 — Toasts
  - Sonner : 2 toasts visibles, erreurs persistantes ; `lib/flash.ts` + `FlashToast` ; inventaire des actions d'écriture et ajout des toasts manquants (création et modification d'employé) ; tests.
  - _→ R5, N12_
- [x] T3.1.7 — Export CSV (backend)
  - `src/finance/csv.ts` ; `GET /transactions/export`, `GET /invoices/export` ; plafond 10 000 ; audit ; `test/finance-export.int-spec.ts` (8 rôles + 401, scope DM, format, injection, plafond, audit).
  - _→ R4.1–R4.4, N5_
- [x] T3.1.8 — Export CSV (interface)
  - Bouton « Exporter » sur `/finance/transactions` et `/finance/invoices` ; erreurs et succès par toast ; tests.
  - _→ R4.5, N5_
- [x] T3.1.9 — Navigation responsive
  - `app-shell.tsx`, sidebar réductible (64 px / 260 px, `localStorage`), `ui/sheet.tsx`, tiroir mobile remplaçant les icônes de la topbar ; tests (clavier, Échap, focus, permissions).
  - _→ R6, N7_
- [x] T3.1.10 — Bascule de thème globale
  - `lib/theme.ts`, cookie `gfep-theme`, classe posée par le layout racine, `theme-toggle.tsx` dans la topbar, `/design-system` aligné ; tests.
  - _→ R7, N8_
- [x] T3.1.11 — Vue en cartes mobile de la liste des employés
  - Même structure que les autres listes ; test.
  - _→ R1.3, N12_
- [x] T3.1.12 — Dashboard SUPER_ADMIN consolidé
  - `DashboardService` + DTO (`pendingDocumentsTotal`) ; `AdminCards` en grille 12 colonnes ; tests backend (`modules`, `roles-matrix`) et frontend.
  - _→ R8, N10_
- [x] T3.1.13 — Filtres `ownerId` et `departmentId` sur `GET /documents`
  - Combinés avec M9 ; tests d'intégration (dont un utilisateur qui ne doit pas voir un document du département filtré).
  - _→ R9.1, N11_
- [x] T3.1.14 — Fiche employé : « Documents liés » et « Historique »
  - Sections conditionnées par `documents:read` et `audit:read` ; états ; tests frontend.
  - _→ R9.2, N11_
- [x] T3.1.15 — Détail de département : « Ressources documentaires » **(dérivé — à valider)**
  - Section conditionnée par `documents:read` ; états ; filtres actifs sur `/documents` ; tests frontend.
  - _→ R9.3, N11_
- [x] T3.1.16 — Corrections issues de la revue T3.1.1
  - Écarts relevés et corrigés : vues en cartes mobile (audit, mappings AD), squelettes (4 écrans), fils d'Ariane (document, facture), page 404 (N31).
  - _→ R1.4_
- [x] T3.1.17 — Critère de passage 3.1
  - `npm run lint`, `npm run build`, `npm test` (résultats collés).
  - Contrôle sur l'application compilée (base de dev) : chaque écran d'AppFlow §2 hors `/profile`, `/admin/settings`, pour chaque rôle concerné → 200 ou redirection attendue, aucune 404.
  - `PROGRESS.md` : ligne 3.1 (et mention du report de N3).
  - _→ R11, N3_
- [ ] T3.1.V — Validation manuelle utilisateur (navigateur) — **cochée par l'utilisateur uniquement** — non vérifié visuellement, à valider par l'utilisateur
  - [ ] Tous les écrans (hors `/profile`, `/admin/settings`) en clair et en sombre, desktop / tablette / mobile.
  - [ ] Tiroir mobile, sidebar réduite et réductible, bascule de thème sans flash.
  - [ ] Tri des tableaux, export CSV ouvert dans un tableur (accents, montants, dates).
  - [ ] Toasts (création d'employé avec redirection, 2 au plus, erreurs persistantes).
  - [ ] Dashboard SUPER_ADMIN, fiche employé, détail de département, `/finance`.
- [ ] T3.1.C — Commit « Étape 3.1 : finition UI/UX », après T3.1.V

---

## Étape 3.2 — Profil utilisateur et paramètres

- [x] T3.2.0 — Vérifications de départ
  - _→ T6.1_
- [x] T3.2.1 — Lien « Mot de passe oublié » sur `/login` + test
  - _→ R12, N13_
- [x] T3.2.2 — Seed : `profile:read`, `profile:update` (8 rôles), `settings:read`, `settings:write` (SA) ; 34 permissions ; tests du seed
  - _→ N15, N16, N29_
- [x] T3.2.3 — `GET /profile` (module `profile/`) + tests d'accès et d'isolation
  - _→ R13.1, N15_
- [x] T3.2.4 — Politique de mot de passe (`password-policy.ts`, liste courante) + tests unitaires
  - _→ R14.2, N14_
- [x] T3.2.5 — `PATCH /profile/password` : throttler par compte, révocation des autres sessions, audit, notification `SECURITY` ; `test/profile.int-spec.ts`
  - _→ R14, N14_
- [x] T3.2.6 — Migration `system_settings` (+ `05`, `schema.spec.ts`, `DECISIONS.md`)
  - _→ R15.1, N16, N30_
- [x] T3.2.7 — `SettingsService`, `GET`/`PATCH /admin/settings`, durée de session appliquée aux nouvelles sessions ; `test/settings.int-spec.ts`
  - _→ R15.2–R15.4, N16_
- [x] T3.2.8 — Écran `/profile` (informations, mot de passe, apparence) + lien topbar + tests
  - _→ R13.2, R14, N8, N14_
- [x] T3.2.9 — Écran `/admin/settings` + entrée de navigation + redirection `/admin` + tests
  - _→ R15.5, N16_
- [x] T3.2.10 — Critère de passage 3.2
  - Lint, build, test collés ; changement de mot de passe vérifié sur l'application compilée ; `/profile` et `/admin/settings` ajoutés au contrôle de T3.1.17 ; `PROGRESS.md`.
  - _→ R16_
- [ ] T3.2.V — Validation manuelle utilisateur — **cochée par l'utilisateur uniquement**
  - [ ] Changement de mot de passe d'un compte local, reconnexion.
  - [ ] Préférence de thème conservée après rechargement, déconnexion et reconnexion.
  - [ ] `/profile` (dont compte AD sans section mot de passe), `/admin/settings`, lien « Mot de passe oublié », clair/sombre, responsive.
- [ ] T3.2.C — Commit « Étape 3.2 : profil et paramètres », après T3.2.V

---

## Étape 3.3 — Durcissement sécurité (sans `APP_MODE`, M35)

- [ ] T3.3.0 — Vérifications de départ
  - _→ T6.1_
- [ ] T3.3.1 — Logs Pino, `requestId`, masquage, `LOG_FILE`
  - _→ R17.1, R17.2, N17_
- [ ] T3.3.2 — Journalisation des événements métier après commit (file par transaction) ; `test/logging.int-spec.ts`
  - _→ R17.3, N17_
- [ ] T3.3.3 — Migration `request_counters` (+ `05`, `schema.spec.ts`, `DECISIONS.md`)
  - _→ R18.1, N18, N30_
- [ ] T3.3.4 — `PrismaThrottlerStorage` (login, login-ad, password-change)
  - _→ R18.2, N18_
- [ ] T3.3.5 — `repeated_forbidden` persistant ; `test/persistent-counters.int-spec.ts` (redémarrage simulé)
  - _→ R18.3, N18_
- [ ] T3.3.6 — `helmet` côté backend (exceptions aperçu) ; `test/security-headers.int-spec.ts`
  - _→ R19.1, N19_
- [ ] T3.3.7 — En-têtes et CSP à nonce côté frontend (ou repli documenté, utilisateur prévenu)
  - _→ R19.2, N19_
- [ ] T3.3.8 — `npm audit` : retrait de `@nestjs/mau`, correctifs mineurs, `overrides` `postcss`
  - _→ R21.1, N21_
- [ ] T3.3.9 — Node 24 (`.nvmrc`, `engines`, `@types/node`) ; retrait de `NEXT_PUBLIC_API_URL` du `.env` racine
  - _→ R21.2, N4_
- [ ] T3.3.10 — Évaluation de `ldapts` (non bloquante) ; décision consignée
  - _→ R21.3, N22_
- [ ] T3.3.11 — Revue OWASP Top 10 : `OWASP-REVIEW.md` ; corrections avec tests (une sous-tâche par écart)
  - _→ R20, N20_
- [ ] T3.3.12 — Critère de passage 3.3
  - Lint, build, test, `npm audit` collés ; `OWASP-REVIEW.md` sans écart ouvert ; `PROGRESS.md`.
  - _→ R22_
- [ ] T3.3.V — Validation manuelle utilisateur — **cochée par l'utilisateur uniquement**
  - [ ] Navigation complète sans violation CSP dans la console, aperçu PDF et image fonctionnels.
  - [ ] Lecture de `OWASP-REVIEW.md`.
- [ ] T3.3.C — Commit « Étape 3.3 : durcissement sécurité », après T3.3.V

---

## Étape 3.4 — Tests automatisés

- [ ] T3.4.0 — Vérifications de départ
  - _→ T6.1_
- [ ] T3.4.1 — Script `typecheck` (backend tests compris, frontend) enchaîné dans `lint`
  - _→ R23.2, N24_
- [ ] T3.4.2 — Verrou consultatif de la suite backend + test (deux exécutions)
  - _→ R23.3, N25_
- [ ] T3.4.3 — Couverture backend : configuration, seuils 80 % / 70 %, tests complémentaires
  - _→ R24.1, R24.2, N27_
- [ ] T3.4.4 — Tests frontend complémentaires (N26)
  - _→ R24.3, N26_
- [ ] T3.4.5 — Workflow `.github/workflows/ci.yml` ; commandes rejouées localement sur une installation propre
  - _→ R23.1, N23_
- [ ] T3.4.6 — Critère de passage 3.4
  - Lint, build, test, couverture collés ; `PROGRESS.md`.
  - _→ R25_
- [ ] T3.4.V — Validation manuelle utilisateur — **cochée par l'utilisateur uniquement**
  - [ ] Lecture du workflow CI (et, si l'utilisateur pousse, premier passage vert).
- [ ] T3.4.C — Commit « Étape 3.4 : tests automatisés », après T3.4.V

---

## Étape 3.5 — Documentation API

- [ ] T3.5.0 — Vérifications de départ
  - _→ T6.1_
- [ ] T3.5.1 — `@nestjs/swagger`, plugin CLI, `setupSwagger` (développement uniquement), CSP de `/api/docs`
  - _→ R26.1, N28_
- [ ] T3.5.2 — Annotations : rôles et permission générés, cookie, erreurs, réponses (DTO, CSV, binaires)
  - _→ R26.2, N28_
- [ ] T3.5.3 — `test/openapi.int-spec.ts` (inventaire complet, schémas) et 404 hors développement
  - _→ R27, N28_
- [ ] T3.5.4 — Critère de passage 3.5
  - Lint, build, test collés ; `PROGRESS.md` (fin du MVP 3).
  - _→ R27_
- [ ] T3.5.V — Validation manuelle utilisateur — **cochée par l'utilisateur uniquement**
  - [ ] `/api/docs` en développement : parcours de quelques endpoints, absence en production.
- [ ] T3.5.C — Commit « Étape 3.5 : documentation API », après T3.5.V
