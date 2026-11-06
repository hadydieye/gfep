# Requirements — MVP 3 (étapes 3.1 à 3.5)
## Guinea Finance Enterprise Portal (GFEP)

---

## Introduction

Ce document définit les exigences du MVP 3 de GFEP, dans l'ordre exact de `06-Implementation-Plan.md` :
- 3.1 passe de finition UI/UX ;
- 3.2 profil utilisateur et paramètres ;
- 3.3 durcissement sécurité (sans `APP_MODE`, M35) ;
- 3.4 tests automatisés ;
- 3.5 documentation API.

**Sources de vérité :**
- `01-PRD.md`, `02-TRD.md`, `03-AppFlow.md`, `04-UXUI-Design-System.md`, `05-Backend-Schema.md`, `06-Implementation-Plan.md` ;
- `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md` (C, D, I) ;
- `.kiro/specs/gfep-mvp2/DECISIONS.md` (M) ;
- `.kiro/specs/gfep-mvp3/DECISIONS.md` (N).

### Hors périmètre
- `APP_MODE` et séparation de modules de `06` §3.3 (M35), vulnérabilités pédagogiques, `LAB_MODE`, Wazuh / Sysmon, vrai Active Directory (DC01) : `06` §3.
- Réinitialisation administrative ou en libre-service du mot de passe (N13 : manque connu, reporté).
- Création de compte via l'interface (M17), suppression d'employé et édition de département (M24).
- Accélération de la suite backend (N27).

### Glossaire
- **SA, ITA, ITT, HR, ACC, DM, EMP, AUD** : SUPER_ADMIN, IT_ADMINISTRATOR, IT_TECHNICIAN, HR_MANAGER, ACCOUNTANT, DEPARTMENT_MANAGER, EMPLOYEE, AUDITOR.
- **Tableau paginé** : liste servie par un endpoint `?page=&limit=` (employés, documents, transactions, factures, comptes, audit).
- **Visibilité M9** : règle de visibilité des documents de `gfep-mvp2/DECISIONS.md` M9.

---

## Exigences transverses (toutes les étapes)

### Exigence T1 — Interdiction par défaut
**Traçabilité :** TRD §6, `05` §5.4, I15.
1. Every new route SHALL carry `@Roles(...)` AND `@Permission(resource, action)`. No new `@Public()` route is introduced; `@AuthenticatedOnly()` stays reserved to `/auth/me` and `/auth/logout`.
2. `test/route-access.int-spec.ts` SHALL keep passing after each step.

### Exigence T2 — Contrôle d'accès vérifié par rôle
**Traçabilité :** TRD §6, contrainte utilisateur.
1. Each step that adds or changes a route SHALL add integration tests asserting, for the 8 roles, allowed (2xx) or denied (403) on each such route, plus 401 without session.
2. Service-level rules (scope DM, visibility M9, ownership, anti-escalation) SHALL be tested in addition to the guards.

### Exigence T3 — Validation et erreurs
**Traçabilité :** TRD §6, §9, I17.
1. Every input DTO (body and query) SHALL use class-validator with `whitelist` and `forbidNonWhitelisted`; every validation error SHALL be the generic `« Données invalides. »` response.
2. Every list endpoint SHALL stay paginated (`limit` ≤ 100, default 25).

### Exigence T4 — Design system
**Traçabilité :** `04` §2–§8, M25.
1. Every new or modified screen SHALL use the design tokens only (no `gray-`/`slate-` classes, no hard-coded colour), Lucide icons only, and SHALL render correctly in light and dark themes with WCAG AA contrast.
2. Every new screen SHALL provide loading (skeleton), empty, error (with retry) and access-denied states (AppFlow §7). No placeholder or « prochainement » text SHALL be visible.

### Exigence T5 — Migrations
**Traçabilité :** M2, N30.
1. Migrations SHALL be additive only, one per need, each with an update of `05-Backend-Schema.md` §3, of `schema.spec.ts` and an entry in `DECISIONS.md`.

### Exigence T6 — Discipline d'étape
**Traçabilité :** `06` §3, N1.
1. Before each step: `docker ps` (`gfep_postgres` healthy), `npm run lint`, `npm run build`, `npm test` SHALL be green, otherwise the work stops.
2. The pass criterion of `06` SHALL be verified concretely and recorded in `PROGRESS.md`; browser checks SHALL be listed as unchecked manual-validation items for the user.
3. One commit per step, only after the user's manual validation; `git status` checked before the commit (no `.env`, key or secret).

---

## Étape 3.1 — Passe de finition UI/UX

### Exigence R1 — Conformité des écrans existants
**Traçabilité :** `06` §3.1, `04` §3–§8, AppFlow §2, N3, N12.
1. Every screen of AppFlow §2, except `/profile` and `/admin/settings` (3.2), SHALL exist, be responsive (desktop, tablet, mobile), and respect the palette and typography.
2. `/finance` SHALL redirect to `/finance/transactions` instead of returning 404.
3. Every data list SHALL render as stacked cards below 768 px (`04` §6), including `/employees`.
4. A review of every screen against `04` §3–§8 SHALL be recorded (screen × rule checklist in `PROGRESS.md` notes or task notes), and every gap found SHALL be fixed in 3.1.

### Exigence R2 — Tokens et ombres
**Traçabilité :** `04` §4.3, §9, N9.
1. A `--shadow-card` token SHALL be defined for light and dark themes; the 7 hard-coded `rgba(0,0,0,0.06)` shadows SHALL use it.
2. An automated test SHALL fail if a hard-coded colour (`rgba(`, `rgb(`, hex) or a `gray-`/`slate-`/`zinc-`/`neutral-` class appears in `src/` outside `app/design-system/` and tests.

### Exigence R3 — Tri par colonne
**Traçabilité :** `04` §4.2, N6.
1. The endpoints `GET /employees`, `/documents`, `/transactions`, `/invoices`, `/access/users`, `/audit/logs`, `/audit/security-events`, `/audit/auth-events` SHALL accept `sort` (per-endpoint whitelist) and `order` (`asc`|`desc`); any other value SHALL return the generic 400.
2. Sorting SHALL be applied in the database query with a stable secondary key; without `sort`, the current default order SHALL be unchanged; scope DM and visibility M9 SHALL still apply.
3. The corresponding tables SHALL expose clickable, keyboard-accessible column headers with `aria-sort`, state kept in the URL, and a reset to page 1 on change.
4. The employee table of `/departments/[id]` SHALL be sortable client-side.

### Exigence R4 — Export CSV
**Traçabilité :** PRD §4.6, M14, N5.
1. `GET /transactions/export` and `GET /invoices/export` SHALL return a CSV of all rows matching the list filters and sort, with the same roles, permissions and scope DM as the list.
2. The CSV SHALL use `;`, UTF-8 with BOM, CRLF, French headers, `AAAA-MM-JJ` dates, comma decimals without float conversion, RFC 4180 quoting, and SHALL neutralise formula injection (`=`, `+`, `-`, `@`, tab, CR prefixed by `'`).
3. Above 10 000 rows, the endpoint SHALL return 400 with an actionable business message.
4. Each export SHALL write an audit entry (`transaction.export`, `invoice.export`) with filters and row count, and no exported data.
5. `/finance/transactions` and `/finance/invoices` SHALL offer an « Exporter » action using the current filters and sort.

### Exigence R5 — Retour d'action (toasts)
**Traçabilité :** PRD §5.3, `04` §4.6, AppFlow §6, N12.
1. Every successful write action of the application SHALL display a confirmation toast in French; after a creation followed by a redirect, the toast SHALL appear on the destination page.
2. At most 2 toasts SHALL be visible at once; success/info toasts SHALL last 4 s; error toasts SHALL persist until closed.

### Exigence R6 — Navigation responsive
**Traçabilité :** `04` §3, §6, AppFlow §4, N7.
1. Below 768 px, navigation SHALL be a drawer opened from the topbar, closable by Escape, outside click, close button and navigation, with focus trapped while open and returned to the trigger.
2. From 768 px to 1279 px, the sidebar SHALL be collapsed to icons (64 px) by default; at 1280 px and above, it SHALL be 260 px and collapsible to 64 px on demand. The preference SHALL be kept in `localStorage`.
3. Collapsed entries SHALL keep an accessible name; entries SHALL remain filtered by permission.

### Exigence R7 — Bascule de thème globale
**Traçabilité :** `04` §5, AppFlow §4, N8.
1. A theme toggle SHALL be available in the topbar of every authenticated screen.
2. The choice SHALL be stored in the `gfep-theme` cookie and applied server-side on `<html>` on every page (including `/login`, `/login/ad`, `/design-system`), without a flash of the wrong theme and without inline script.
3. The default theme SHALL be light.

### Exigence R8 — Dashboard SUPER_ADMIN consolidé
**Traçabilité :** AppFlow §5, N10.
1. `GET /dashboard` for SUPER_ADMIN SHALL additionally return: month income/expense and pending invoices; pending documents of all departments (5 latest and total); headcount by department and 5 latest hires; HIGH/CRITICAL security alerts and recent security events.
2. `/dashboard` for SUPER_ADMIN SHALL render these cards with real data and their empty states.

### Exigence R9 — Fiche employé et détail de département
**Traçabilité :** AppFlow §3.4, §3.5, N11.
1. `GET /documents` SHALL accept `ownerId` and `departmentId` (UUID) filters, combined with visibility M9.
2. `/employees/[id]` SHALL show « Documents liés » (owner = employee, visibility M9) to users with `documents:read`, and « Historique » (audit `employee.*` of this record) to users with `audit:read` only.
3. `/departments/[id]` SHALL show « Ressources documentaires » (department of the document per M8, visibility M9) to users with `documents:read`.

### Exigence R10 — Corrections de tests héritées
**Traçabilité :** N12.
1. `test/documents.int-spec.ts:228` SHALL type-check.
2. The property test of `design-system.test.tsx` SHALL have an explicit 30 s timeout.

### Exigence R11 — Critère de passage 3.1
1. Every screen of AppFlow §2 except `/profile` and `/admin/settings` SHALL be verified to exist (HTTP status per role on the compiled app), and the responsive/theme checks SHALL be listed for manual user validation.

---

## Étape 3.2 — Profil utilisateur et paramètres

### Exigence R12 — Lien « Mot de passe oublié »
**Traçabilité :** AppFlow §3.1, N13.
1. `/login` SHALL show a « Mot de passe oublié ? » link that reveals, in place, an identical informational message for everyone, with no new route or endpoint.

### Exigence R13 — Écran `/profile`
**Traçabilité :** AppFlow §3.11, N15.
1. `GET /profile` (permission `profile:read`, 8 roles) SHALL return the connected user's account (username, email, auth provider, roles, last login) and employee record (number, names, department, position, manager, hire date, professional email, phone), read-only.
2. `/profile` SHALL be reachable from the topbar for every role, and SHALL show the information, the password section (LOCAL accounts only) and the theme control of N8.

### Exigence R14 — Changement de mot de passe
**Traçabilité :** TRD §6, `06` §3.2, N14.
1. `PATCH /profile/password` (permission `profile:update`) SHALL require the current password; a wrong current password SHALL return 400 « Mot de passe actuel incorrect. » without incrementing `failedLoginCount`.
2. The new password SHALL be 12–128 characters, different from the current one, SHALL NOT contain the username, first name or last name, and SHALL NOT be in the embedded common-password list; each violation SHALL return 400 with an actionable message.
3. An ACTIVE_DIRECTORY account SHALL receive 409; the interface SHALL not offer the section.
4. More than 5 attempts per account in 15 minutes SHALL return 429.
5. On success, in one transaction: new argon2 hash, revocation of all other sessions (current kept), audit `user.password_change` without any password value, `SECURITY` notification to the user.
6. The user SHALL then be able to log in with the new password only.

### Exigence R15 — Paramètres système
**Traçabilité :** PRD §4.9, AppFlow §3.10, TRD §7, C4, N16.
1. A migration `system_settings` SHALL add the `SystemSetting` model.
2. `GET /admin/settings` (`settings:read`) and `PATCH /admin/settings` (`settings:write`) SHALL be restricted to SUPER_ADMIN.
3. The session duration SHALL be editable (integer 1–12 hours, default 8) and SHALL apply to sessions created afterwards (database expiry and cookie `maxAge`).
4. Each modification SHALL write an audit entry `setting.update` with old and new values.
5. `/admin/settings` SHALL show the effective read-only configuration and the editable session duration; an « Paramètres » entry SHALL appear for `settings:read` only.

### Exigence R16 — Critère de passage 3.2
1. A local user SHALL change their password (automated test, then manual check); the theme preference SHALL persist across reload, logout and login on the same browser (manual check).
2. The 3.1 criterion SHALL be completed for `/profile` and `/admin/settings`.

---

## Étape 3.3 — Durcissement sécurité (mode sécurisé)

### Exigence R17 — Logs structurés
**Traçabilité :** TRD §2, §5, §7, §11, M20, N17.
1. The backend SHALL log in JSON with Pino; every HTTP request SHALL get a server-generated `requestId`, present in all its log lines and returned in `X-Request-Id`.
2. Secrets (cookies, authorization, passwords, tokens, hashes) SHALL never appear in logs (redaction tested).
3. Every committed `AuditLog`, `AuthEvent` and `SecurityEvent` SHALL produce one structured log line in the TRD §7 format, with the `requestId`; a rolled-back transaction SHALL produce none.

### Exigence R18 — Compteurs persistants
**Traçabilité :** TRD §6, M20, N18.
1. A migration `request_counters` SHALL add the `RequestCounter` model.
2. Rate limiting (`login`, `login-ad`, `password-change`) SHALL use PostgreSQL storage and SHALL survive an application restart.
3. The `repeated_forbidden` counter SHALL use the same storage and SHALL survive a restart; one event per window per account SHALL still hold.

### Exigence R19 — En-têtes de sécurité
**Traçabilité :** TRD §6, OWASP A05, N19.
1. The backend SHALL send helmet security headers on every response, with the CSP exceptions of N19.
2. The frontend SHALL send the headers of N19 and a nonce-based CSP, or the documented fallback of N19.

### Exigence R20 — Revue OWASP et TRD §6
**Traçabilité :** `06` §3.3, TRD §6, N20.
1. `OWASP-REVIEW.md` SHALL cover A01–A10 for every delivered module with evidence; every gap SHALL be fixed with a test.

### Exigence R21 — Dépendances et outillage
**Traçabilité :** D3, M26, N4, N21, N22.
1. `npm audit` SHALL report 0 vulnerabilities, or each remaining one SHALL be documented as an accepted risk.
2. `.nvmrc`, `engines.node` and `@types/node` SHALL be aligned on Node 24; `NEXT_PUBLIC_API_URL` SHALL be removed from the root `.env`.
3. The `ldapts` evaluation SHALL be documented with its result (replacement or reasoned retention of `ldapjs`).

### Exigence R22 — Critère de passage 3.3
1. Code review against the OWASP Top 10 checklist SHALL show no open gap on the delivered modules (`OWASP-REVIEW.md`).

---

## Étape 3.4 — Tests automatisés

### Exigence R23 — Outillage de test
**Traçabilité :** `06` §3.4, N23–N25.
1. A CI workflow SHALL run install, migrations, lint (with type-check), build, tests and coverage on Node 24 with PostgreSQL 16.
2. Backend and frontend SHALL be type-checked, tests included, as part of `npm run lint`.
3. Two simultaneous runs of the backend suite SHALL be impossible: the second SHALL fail immediately with an explicit message.

### Exigence R24 — Couverture
**Traçabilité :** `06` §3.4, N26, N27.
1. Backend tests SHALL cover the authentication flows (local, AD mocked), RBAC guards and CRUD of each module (existing suites, completed where gaps are found).
2. Backend coverage on `auth/`, `rbac/`, `access/`, `ad-auth/`, `security/` SHALL reach at least 80 % lines and 70 % branches, enforced.
3. Frontend tests SHALL cover the main screens and navigation listed in N26.

### Exigence R25 — Critère de passage 3.4
1. The suite SHALL be runnable in CI (workflow validated locally by running its commands in a clean install) with the coverage thresholds met.

---

## Étape 3.5 — Documentation API

### Exigence R26 — Swagger / OpenAPI
**Traçabilité :** TRD §2, §9, `06` §3.5, N28.
1. `/api/docs` SHALL be served only when `NODE_ENV=development`, and SHALL return 404 otherwise.
2. Every route SHALL appear with its request and response schemas, roles and permission, cookie authentication and error responses.

### Exigence R27 — Critère de passage 3.5
1. An automated test SHALL prove that every route of the router inventory appears in the OpenAPI document with its schemas.
