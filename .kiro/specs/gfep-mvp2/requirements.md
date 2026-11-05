# Requirements — MVP 2 (étapes 2.1 à 2.7)
## Guinea Finance Enterprise Portal (GFEP)

---

## Introduction

Ce document définit les exigences du MVP 2 de GFEP, dans l'ordre exact de `06-Implementation-Plan.md` :
- 2.1 seed complet ;
- 2.2 documents ;
- 2.3 finance ;
- 2.4 RBAC complet ;
- 2.5 notifications ;
- 2.6 administration et audit ;
- 2.7 authentification Active Directory contre un LDAP de test.

**Sources de vérité :**
- `01-PRD.md`, `02-TRD.md`, `03-AppFlow.md`, `04-UXUI-Design-System.md`, `05-Backend-Schema.md`, `06-Implementation-Plan.md` ;
- `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md` (C, D, I) ;
- `.kiro/specs/gfep-mvp2/DECISIONS.md` (M).

### Hors périmètre
- Vulnérabilités pédagogiques, `LAB_MODE` / `APP_MODE`, Wazuh / Sysmon, vrai Active Directory (DC01) : `06` §3.
- Export CSV finance (reporté à 3.1, M14), `/admin/settings` et `/profile` (3.2), logs Pino et `requestId` (3.3), Swagger (3.5).
- Création de compte via l'interface (M17). Suppression d'employé et édition de département (M24).

### Glossaire
- **SA, ITA, ITT, HR, ACC, DM, EMP, AUD** : SUPER_ADMIN, IT_ADMINISTRATOR, IT_TECHNICIAN, HR_MANAGER, ACCOUNTANT, DEPARTMENT_MANAGER, EMPLOYEE, AUDITOR.
- **Scope DM** : restriction aux données du département de l'employé rattaché au compte DEPARTMENT_MANAGER (I6).
- **Département d'un document** : `category.departmentId`, à défaut `owner.departmentId` (M8).
- **Document sensible** : niveau `CONFIDENTIAL` ou `RESTRICTED`.
- **Matrice d'accès** : table rôle × permission de `design.md` §2.

---

## Exigences transverses (toutes les étapes)

### Exigence T1 — Interdiction par défaut
**Traçabilité :** TRD §6, `05` §5.4, I15, contrainte utilisateur.

1. THE Backend SHALL apply SessionGuard, RoleGuard and PermissionGuard globally to every new route.
2. Every new route SHALL carry `@Roles(...)` AND `@Permission(resource, action)`, except :
   - `POST /auth/login-ad`, which SHALL carry `@Public()` (justification : point d'entrée d'authentification, équivalent de `/auth/login`) ;
   - `/auth/me` and `/auth/logout`, the only routes allowed to carry `@AuthenticatedOnly()`.
3. `test/route-access.int-spec.ts` SHALL keep passing after each step, with `POST /api/v1/auth/login-ad` added to the allowed public routes in 2.7.

### Exigence T2 — Contrôle d'accès vérifié par rôle à chaque étape
**Traçabilité :** TRD §6, contrainte utilisateur.

1. Each step SHALL add automated backend integration tests, on the isolated test database (I12), asserting for each existing role : allowed (2xx) or denied (403) on every route introduced by the step. From 2.4 onwards, all 8 roles are covered.
2. Each step SHALL test its service-level rules (scope DM, ownership, visibility) in addition to the guards.
3. The last task of each step SHALL be the concrete verification of the pass criterion of `06`, recorded in `PROGRESS.md`.

### Exigence T3 — Validation et erreurs
**Traçabilité :** TRD §6, §9, I17.

1. Every input DTO SHALL use class-validator with `whitelist` and `forbidNonWhitelisted`. Every 400 SHALL be the generic `« Données invalides. »` response.
2. Every list endpoint SHALL be paginated (`page`, `limit` ≤ 100, default 25).
3. A resource the user cannot see SHALL return 404 when revealing its existence would leak information (documents, M9). Otherwise 403.

### Exigence T4 — Design system
**Traçabilité :** `04` §2–§8, PRD §5, AppFlow §4 et §7, M25.

1. Every new screen SHALL use only GFEP tokens, Lucide icons, customized ui components, and pass the light and dark contrast tests (WCAG AA).
2. Every list or detail screen SHALL provide four distinct states : skeleton, empty (with a contextual message), error (with retry), and 403 versus 404.
3. Sidebar entries SHALL be generated from the user's permissions. No disabled entry is shown.
4. No placeholder text SHALL be visible. A dashboard card is rendered only when its module provides real data (M25).
5. Every destructive or irreversible action SHALL require a confirmation modal. Every successful action SHALL show a toast (4 s for success, persistent for errors).

### Exigence T5 — Migrations et schéma
**Traçabilité :** M2.

1. Schema changes SHALL be additive Prisma migrations only, one per need, each reflected in `05-Backend-Schema.md` §3 and in `DECISIONS.md`.
2. The test checking that `schema.prisma` matches `05` (`schema.spec.ts`) SHALL be updated in the same task as the migration.

---

## Étape 2.1 — Jeu de données complet (seed)

### Exigence 1 — Seed complet sans doublon
**Traçabilité :** `05` §7, `06` §2.1, M3, M4, M5, I11.

1. THE Backend SHALL provide `prisma/seed.ts` as the Prisma seed command. It extends the MVP 1 dataset with idempotent upserts.
2. Running the seed twice SHALL produce identical row counts : no duplicates.
3. THE seed SHALL refuse to run when `NODE_ENV=production` : explicit message on stderr, non-zero exit code, no write.
4. After 2.1, THE seed SHALL produce :
   - 6 departments, 18 positions (3 per department), 40 employees, 40 users (one per employee, all `LOCAL`) ;
   - 6 document categories, 50 documents with real files on disk, 30 invoices, 100 transactions ;
   - the 3 MVP 1 roles with their 6 permissions (M3).
5. THE seed SHALL apply the data changes of M5 :
   - new employees Thierno Baldé (DG, Directeur général, department head), Ibrahima Sow (CF, Comptable), Souleymane Touré (AC, Auditeur), Fodé Kaba (IT, Technicien support) ;
   - Mohamed Keïta moved to IT as « Administrateur systèmes » ;
   - Ibrahim Sow (GF-2026-003) unchanged.
6. Passwords SHALL be one demo password per role, overridable by `SEED_PASSWORD_<ROLE>`. They are never logged, and only the argon2 hash is stored.
7. Usernames SHALL follow `initiale.nom` (lowercase, no accents), falling back to `prenom.nom` on collision.
8. Document files SHALL be written under `DOCUMENTS_STORAGE_DIR`, with internal names that are random UUIDs.

### Exigence 2 — Tests alignés sur le seed complet
**Traçabilité :** M3.

1. From 2.1, the integration tests SHALL seed with the complete seed.
2. MVP 1 tests whose expected values depend on volumes SHALL be updated in 2.1.
3. The seed test SHALL assert the volumes of R1.4 and idempotence.

### Exigence 3 — Critère de passage 2.1
**Traçabilité :** `06` §2.1.

1. WHEN `npx prisma db seed` is run on a migrated database, IT SHALL complete without error and populate every table at the volumes of R1.4.
2. Roles (8) and permissions (30) reach the `05` §7 volumes at 2.4 and 2.7 (M3, M24).

---

## Étape 2.2 — Module Documents

### Exigence 4 — Visibilité des documents
**Traçabilité :** PRD §4.5, AppFlow §3.6, `05` §5.4.3, M8, M9.

1. THE Backend SHALL expose a document to a user holding `documents:read` only if one of the following holds :
   - the user is SA ;
   - the user is the owner ;
   - the level is `PUBLIC` ;
   - the level is `INTERNAL` and the user's department equals the document's department ;
   - the user holds an explicit `DocumentPermission` on the document.
2. `CONFIDENTIAL` and `RESTRICTED` documents SHALL be visible only through an explicit permission (besides the owner and SA).
3. A non-visible document SHALL return 404 on every document route. It SHALL never appear in lists, counts or dashboard cards.
4. The visibility rule SHALL be enforced in the backend query, not only in the UI.

### Exigence 5 — Dépôt de documents
**Traçabilité :** PRD §4.5, AppFlow §3.6, M10, M11.

1. THE Backend SHALL expose `POST /api/v1/documents` (multipart) with `title`, `description?`, `categoryId`, `confidentialityLevel` and one file.
2. THE Backend SHALL reject :
   - files larger than 10 MB ;
   - files whose magic bytes are not PDF, DOCX, XLSX, PNG or JPEG.

   The declared extension and MIME type SHALL be ignored, and the rejection is a generic 400.
3. Non-SA users SHALL upload only into a category of their own department or one with no department. Otherwise 403.
4. A new document SHALL be `PENDING`. Its owner is the uploader's employee record.
5. The file SHALL be stored under a random UUID name inside `DOCUMENTS_STORAGE_DIR`. No user-provided name is ever used as a path.

### Exigence 6 — Consultation, aperçu, téléchargement
**Traçabilité :** AppFlow §3.6, M10, M12.

1. THE Backend SHALL expose :
   - the paginated list, filterable by category, confidentiality, validation status and search on the title ;
   - the detail ;
   - the download, as `attachment` with `nosniff` ;
   - the preview, as `inline`, for PDF, PNG and JPEG only, otherwise 404.
2. Viewing or downloading a sensitive document SHALL write an audit entry (`document.view` or `document.download`) with the actor and source IP.

### Exigence 7 — Validation des documents
**Traçabilité :** PRD §3 (persona DM), AppFlow §5, M7.

1. THE Backend SHALL add `Document.validationStatus` (`PENDING` | `VALIDATED` | `REJECTED`, default `PENDING`) through an additive migration.
2. Only the DM of the document's department, or the SA, SHALL change a `PENDING` document to `VALIDATED` or `REJECTED`. Otherwise 403. Each decision is audited (`document.validate`).
3. The validation status SHALL not affect visibility.

### Exigence 8 — Partage et suppression
**Traçabilité :** PRD §4.5, M11.

1. Only the owner or the SA SHALL grant or revoke a `DocumentPermission` (READ, WRITE or DELETE) to a user account. Each change is audited (`document.share`).
2. The owner or SA SHALL be able to list share recipients for that document through `GET /api/v1/documents/:id/share-recipients`; the response SHALL contain only account ID, username and employee display name.
3. Only the owner, holders of a `DELETE` permission, or the SA SHALL delete a document.
   - Deletion removes the file and the permissions.
   - It is audited (`document.delete`).
   - The UI requires a confirmation modal.

### Exigence 9 — Écrans documents
**Traçabilité :** AppFlow §3.6, §5, `04`, M25.

1. THE Frontend SHALL expose `/documents` (library : filters, search, confidentiality and validation badges, pagination), `/documents/[id]` and `/documents/upload`.
2. `/documents/[id]` SHALL show :
   - the metadata and the preview (PDF and images) ;
   - the download button ;
   - the validation actions, for validators ;
   - the sharing panel, for the owner and the SA ;
   - the delete action, for allowed users.
3. The dashboard SHALL show :
   - « Mes documents récents » (EMPLOYEE) : the 5 most recent visible documents ;
   - « Documents en attente de validation » (DM) : the `PENDING` documents of the department.
4. The MVP 1 placeholder cards SHALL be removed (M25).
5. The « Documents » sidebar entry SHALL be shown only to holders of `documents:read`.

### Exigence 10 — Critère de passage 2.2
**Traçabilité :** `06` §2.2.

1. An EMPLOYEE SHALL see only the documents of their department (`INTERNAL`), `PUBLIC` documents, their own documents, and those explicitly shared with them.
2. This SHALL be verified by an automated test with two EMPLOYEE accounts from different departments, plus a manual check.

---

## Étape 2.3 — Module Finance

### Exigence 11 — Rôle ACCOUNTANT et rattachement au département
**Traçabilité :** `06` §2.3, M6, M13.

1. Step 2.3 SHALL create the `ACCOUNTANT` role, its finance permissions, and assign it to `ibrahima.sow`.
2. THE Backend SHALL add a nullable `departmentId` (relation to `Department`, indexed) to `Transaction` and `Invoice` through one additive migration. The seed SHALL fill it.

### Exigence 12 — Transactions
**Traçabilité :** PRD §4.6, AppFlow §3.7, TRD §7, M13, M14.

1. THE Backend SHALL expose the paginated list of transactions, filterable by type, status, department, period and reference.
2. ACC and SA see all transactions. A DM sees only those of their department. Every other role gets 403.
3. ACC and SA SHALL create transactions :
   - type, amount > 0 (2 decimals), description, mandatory `departmentId` ;
   - generated reference `TRX-{AAAA}-{NNNNN}` ;
   - status `PENDING` ;
   - audited (`transaction.create`).
4. Only the SA SHALL validate or reject a `PENDING` transaction. Otherwise 403 or 409. The decision is audited (`transaction.status_change`).
5. Amounts SHALL be serialized as strings. Currency `GNF`.

### Exigence 13 — Factures
**Traçabilité :** PRD §4.6, AppFlow §3.7, M14.

1. THE Backend SHALL expose the paginated list of invoices, filterable by status, department, due date and client, plus the detail. Visibility follows R12.2.
2. Invoices SHALL be read-only, except for the status change by ACC or SA along the allowed transitions of M14. An invalid transition SHALL return **400** (business message), and every forbidden transition SHALL be covered by a test. The change is audited (`invoice.status_change`).

### Exigence 14 — Écrans finance
**Traçabilité :** AppFlow §3.7, §5.

1. THE Frontend SHALL expose `/finance/transactions`, `/finance/transactions/new`, `/finance/invoices` and `/finance/invoices/[id]`, with status badges and amounts formatted in `fr-FR`.
2. The « Finance » sidebar entry SHALL be visible only to holders of `transactions:read` or `invoices:read`.
3. The ACC dashboard SHALL show : recent transactions, pending invoices (`SENT` and `OVERDUE`), and financial indicators for the current month (validated income and expenses).

### Exigence 15 — Critère de passage 2.3
**Traçabilité :** `06` §2.3.

1. Automated tests SHALL verify :
   - ACCOUNTANT : full access ;
   - DEPARTMENT_MANAGER : read only, limited to their department ;
   - every other role : 403 on finance routes and no « Finance » menu entry.

---

## Étape 2.4 — RBAC complet (8 rôles)

### Exigence 16 — Rôles et permissions
**Traçabilité :** `06` §2.4, `05` §7, M5, M6, M24.

1. Step 2.4 SHALL create IT_ADMINISTRATOR, IT_TECHNICIAN, HR_MANAGER and AUDITOR with their permissions, following the access matrix of `design.md` §2. The ACCOUNTANT role already exists (M6).
2. THE seed SHALL reassign the accounts according to M5 : `t.balde` SA, `m.keita` ITA, `f.camara` HR, `a.barry` DM, `s.toure` AUD, `f.kaba` ITT.
3. The `@Roles` of every existing route SHALL be updated to match the matrix.
4. The MVP 1 tests that assumed the former accounts SHALL be updated in the same step (Q3).
5. The dashboard SHALL serve the content of AppFlow §5 for each role, plus IT_TECHNICIAN (« État des services », M15). Cards are limited to data that exists (M25).

### Exigence 17 — Changement de statut d'un employé (report T2.4.R1)
**Traçabilité :** AppFlow §3.4, M16.

1. THE Backend SHALL expose `PATCH /api/v1/employees/:id/status`, permission `employees:status` : SA and HR on every department, DM within scope DM.
2. Changing to `SUSPENDED` or `TERMINATED` SHALL, in one transaction :
   - update the employee ;
   - suspend the linked user account ;
   - revoke all its active sessions ;
   - write an audit entry.
3. Changing to `ACTIVE` SHALL reactivate only the employee record.
4. Changing one's own status SHALL return 403.
5. The « Suspendre » button of `/employees/[id]` SHALL be enabled for allowed users, with a confirmation modal and a « Réactiver » counterpart.

### Exigence 18 — Gestion des comptes et déverrouillage manuel (report T2.4.R2)
**Traçabilité :** PRD §4.7, AppFlow §3.8, M17.

1. THE Backend SHALL expose to ITA and SA :
   - the paginated list of accounts (role, status, authentication method, last login) ;
   - role assignment and removal ;
   - account suspension and reactivation, where suspension revokes sessions ;
   - manual unlock (`LOCKED → ACTIVE`, `failedLoginCount = 0`).
2. No account creation SHALL exist in MVP 2.
3. Each operation SHALL be audited. Each role change SHALL notify the user from 2.5 onwards.
4. The anti-escalation guards of M17 SHALL be enforced, and each one SHALL be covered by a test.
5. The last active SUPER_ADMIN SHALL NOT be suspended or demoted by another account :
   - a third-party suspension, reactivation or SUPER_ADMIN role removal SHALL return 403 ;
   - automatic account lockout SHALL apply under I14: the fifth consecutive failed login SHALL set the account to `LOCKED` ;
   - each such lockout SHALL create a HIGH-severity `SecurityEvent account_locked` from step 2.6 and a `WARNING` notification to all active IT_ADMINISTRATOR accounts from step 2.5 ;
   - the IP rate limit SHALL still apply ;
   - recovery SHALL occur through the 15-minute lock expiration defined by I14 or the development seed. Manual unlock through `/access/users` does not apply to this account; no CLI unlock script SHALL be provided.

### Exigence 19 — Matrice rôle ↔ permission
**Traçabilité :** AppFlow §3.8, M18.

1. ITA and SA SHALL read the roles and their permissions. Only the SA SHALL modify a role's permissions.
2. The SUPER_ADMIN role SHALL not be modifiable.
3. A user SHALL not remove a permission from a role they hold.
4. Each change SHALL be audited, and from 2.5 SHALL notify every holder of the role.

### Exigence 20 — Écrans d'accès
**Traçabilité :** AppFlow §3.8, §4.

1. THE Frontend SHALL expose `/access/roles`, `/access/roles/[id]` (read-only for ITA, editable for SA) and `/access/users`. `/access` redirects to `/access/users`.
2. The « Accès » sidebar entry SHALL be visible only to holders of `users:read` or `roles:read`.

### Exigence 21 — Critère de passage 2.4
**Traçabilité :** `06` §2.4.

1. Each of the 8 roles SHALL have a distinct behaviour, verified by automated tests on at least one representative endpoint of each module already built : dashboard, employees, departments, documents, finance, access.

---

## Étape 2.5 — Notifications

### Exigence 22 — API notifications
**Traçabilité :** PRD §4.8, AppFlow §3.9, M19, M24.

1. THE Backend SHALL expose to the 8 roles (`notifications:read` and `notifications:update`) :
   - the paginated list of **the current user's own** notifications, filterable by read or unread ;
   - the unread count ;
   - mark one as read ;
   - mark all as read.
2. Another user's notification SHALL return 404.

### Exigence 23 — Déclencheurs
**Traçabilité :** PRD §4.8, AppFlow §6, `06` §2.5, M19.

1. THE Backend SHALL create the notifications of M19, in the same transaction as the triggering action when it is transactional.
2. A first login, with no prior session, SHALL not trigger the « nouvel appareil » alert.

### Exigence 24 — Écrans notifications
**Traçabilité :** AppFlow §3.9, §4, `04` §4.6.

1. THE Frontend SHALL expose `/notifications` (chronological list, read and unread filter, mark as read) and the topbar badge with the unread count.
2. The EMPLOYEE dashboard card « Mes notifications » SHALL show the latest real notifications.

### Exigence 25 — Critère de passage 2.5
**Traçabilité :** `06` §2.5.

1. Sharing a document SHALL produce a notification visible to the recipient through the API and on the `/notifications` screen.
2. This SHALL be verified by an automated test plus a manual check.

---

## Étape 2.6 — Administration et audit

### Exigence 26 — Journal d'audit complet
**Traçabilité :** TRD §7, `06` §2.6, M12.

1. THE Backend SHALL write an `AuditLog` (actor, action, resource, old and new values without secrets, source IP) for each sensitive action of the MVP :
   - employee create, update and status change ;
   - role assign and remove ;
   - account suspend, reactivate and unlock ;
   - role-permission change ;
   - sensitive document view, download and delete, plus validate and share ;
   - transaction create and status change ;
   - invoice status change ;
   - AD mapping create and delete (2.7).
2. Audit entries SHALL be immutable : no update or delete route. An automated test SHALL prove it, by inventorying every write route (POST, PUT, PATCH, DELETE) and asserting that none modifies or deletes an `AuditLog` (row count and contents unchanged).
3. No password, token or hash SHALL ever appear in `oldValues` or `newValues`.

### Exigence 27 — Événements de sécurité
**Traçabilité :** M20.

1. THE Backend SHALL write a `SecurityEvent` for :
   - `account_locked` ;
   - `repeated_forbidden` (≥ 5 refusals 403 for one account within 5 minutes, at most one per window) ;
   - `ad_unreachable` (2.7).
2. Account locking SHALL also send the `WARNING` notification to the IT_ADMINISTRATORs.

### Exigence 28 — Écran d'audit
**Traçabilité :** AppFlow §3.10, M21.

1. THE Frontend SHALL expose `/admin/audit` to AUD (read) and SA, with three tabs (Journal d'activité, Événements de sécurité, Authentifications), each filterable by date, user and action or type, and paginated.
2. `/admin` redirects to `/admin/audit`.
3. The IT_ADMINISTRATOR SHALL get 403 (M21).
4. `/documents/[id]` SHALL show the consultation history to holders of `documents:history`.
5. The SA « Activité récente » and AUD dashboard cards SHALL use real audit and security data.

### Exigence 29 — Critère de passage 2.6
**Traçabilité :** `06` §2.6.

1. An automated test SHALL perform one action of each earlier type and assert that a matching audit entry exists.
2. A manual check SHALL confirm they appear on `/admin/audit`.

---

## Étape 2.7 — Authentification Active Directory (LDAP de test)

### Exigence 30 — LDAP de test
**Traçabilité :** `06` §2.7, M23, Q19.

1. `docker-compose.yml` SHALL define an OpenLDAP service under the `ad-test` profile :
   - LDAPS only, port 636 bound to `127.0.0.1` ;
   - suffix `dc=guineafinance,dc=local` ;
   - OU Direction, RH, Comptabilite, Informatique, Commercial, Audit, ServiceAccounts ;
   - `svc-ldapreader` ;
   - test users and groups.
2. Its TLS certificate SHALL be generated by a documented script. No real AD is involved.

### Exigence 31 — Flux de connexion AD
**Traçabilité :** `05` §5.2, TRD §8, M23.

1. THE Backend SHALL expose `POST /api/v1/auth/login-ad` (`@Public()`, rate limited to 5 / 15 min / IP), implemented in an `AdAuthModule` never called directly by another controller.
2. Every AD-dependent setting SHALL come from environment variables : URL, base DN, identifier, mail, GUID, SID and group attributes, service account, CA, 3 s timeout.
3. THE Backend SHALL perform, in order :
   1. service bind ;
   2. user search ;
   3. user bind ;
   4. employee resolution : by GUID, otherwise by `mail = professionalEmail`, then GUID and SID stored ;
   5. group → role mapping ;
   6. user upsert (`ACTIVE_DIRECTORY`, no password) ;
   7. role synchronization ;
   8. session and cookie identical to the local flow.
4. THE Backend SHALL refuse :
   - with the generic 401 : no matching employee, no mapped group, or a conflict with a local account ;
   - with the message of AppFlow §3.2 (503) : LDAP unreachable or timed out.

   It SHALL never fall back to local authentication.
5. Each step SHALL write its distinct `AuthEvent` (M23). An unreachable directory SHALL also write `SecurityEvent ad_unreachable`.
6. TLS verification SHALL never be disabled. No AD password SHALL ever be stored.
7. Every provisional choice SHALL be marked `TODO(AD-REVISION)`.

### Exigence 32 — Administration des mappings
**Traçabilité :** `06` §2.7, M22.

1. THE Backend and Frontend SHALL provide `/access/ad-mappings` (list, create, delete) to ITA and SA. Only SA SHALL target the SUPER_ADMIN role. Each change is audited.

### Exigence 33 — Écran `/login/ad`
**Traçabilité :** AppFlow §3.2.

1. `/login/ad` SHALL become a real form (identifier, password, link back to local login), with the generic message on 401 and the AppFlow §3.2 message on 503.
2. The « État des services » card SHALL show the LDAP status.

### Exigence 34 — Critère de passage 2.7
**Traçabilité :** `06` §2.7.

1. Automated tests against the Docker LDAP (`npm run test:ad`) SHALL verify :
   - successful login with group → role mapping ;
   - clean refusal (`AD_UNREACHABLE`) when the LDAP is stopped ;
   - each other refusal case.
2. Unit tests with a mocked LDAP client SHALL cover the decision logic in `npm test`.

---

## Traçabilité

| Source | Exigences |
|---|---|
| PRD §4.5 | 4–9 |
| PRD §4.6 | 11–14 |
| PRD §4.7 | 16–20 |
| PRD §4.8 | 22–25 |
| PRD §4.9 | 26–28 |
| PRD §4.1 (AD) | 30–33 |
| TRD §6 | T1, T3, 5, 31 |
| TRD §7 | 6, 8, 12, 13, 17–19, 26 |
| TRD §8 | 30–32 |
| AppFlow §3.2 | 33 |
| AppFlow §3.4 | 17 |
| AppFlow §3.6 | 4–9 |
| AppFlow §3.7 | 12–14 |
| AppFlow §3.8 | 18–20, 32 |
| AppFlow §3.9 | 22–24 |
| AppFlow §3.10 | 28 |
| AppFlow §5 | 9.3, 14.3, 16.5, 28.5 |
| `05` §5.2 | 31 |
| `05` §5.4 | T1, 4 |
| `05` §7 | 1, 3, 16 |
| `06` §2.1–2.7 | 3, 10, 15, 21, 25, 29, 34 |
