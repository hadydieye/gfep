# DECISIONS — MVP 3 (étapes 3.1 à 3.5)

Ce fichier complète `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md` (C, D, I) et `.kiro/specs/gfep-mvp2/DECISIONS.md` (M1–M35), toujours en vigueur. Les entrées ci-dessous sont numérotées N1, N2…

**Source :** réponses de l'utilisateur du 2026-11-06 aux questions Q1–Q27 de la phase de clarification. Toutes les recommandations ont été validées telles qu'écrites, avec deux nuances (Q11, Q18) reprises dans N13 et N19.

Les entrées marquées **(dérivé — à valider)** ne viennent ni d'un document ni d'une réponse explicite ; elles sont soumises à l'utilisateur avec le résumé de `tasks.md`.

---

## Cadre

### N1 — Périmètre et ordre
- Le MVP 3 suit l'ordre exact de `06-Implementation-Plan.md` : 3.1 → 3.5. Une seule étape à la fois ; une étape ne commence qu'après l'accord explicite de l'utilisateur et la vérification concrète du critère de la précédente.
- **Hors périmètre :** la tâche `APP_MODE` de `06` §3.3 (M35), les vulnérabilités pédagogiques, `LAB_MODE`, Wazuh / Sysmon, le vrai Active Directory (DC01).
- Les règles des MVP précédents restent valables : interdiction par défaut (I15), 400 génériques (I17), verrouillage temporaire (I14), migrations additives uniquement (M2), aucun placeholder visible (M25), garde-fous d'anti-escalade (M17, M18).
- Avant chaque étape : `docker ps` (`gfep_postgres` healthy), `npm run lint`, `npm run build`, `npm test` verts, sinon arrêt.
- Un commit par étape, après la validation manuelle de l'utilisateur ; aucune case « validation manuelle » n'est cochée par l'agent.

### N2 — Organisation de la spec (Q1)
- Spec dans `.kiro/specs/gfep-mvp3/` : `requirements.md`, `design.md`, `tasks.md`, ce fichier, puis `OWASP-REVIEW.md` en 3.3.
- Exigences : `T1…` (transverses) et `R1…` (par étape) ; tâches : `T3.x.y` ; décisions : `N1…`.

### N3 — Critère de passage de 3.1 (Q2)
- Le critère de `06` §3.1 (« chaque écran listé dans `03-AppFlow.md` existe, est responsive, et respecte la palette/typographie ») est vérifié à l'étape 3.1 pour **tous les écrans sauf `/profile` et `/admin/settings`**, qui relèvent de 3.2.
- L'étape 3.2 complète le critère de 3.1 pour ces deux écrans ; `PROGRESS.md` le mentionne sur les deux lignes.

### N4 — Dette d'outillage reçue (Q3)
Traitée à l'étape **3.3**, avec `npm audit` :
- `.nvmrc` = `24`, `engines.node` racine = `>=24 <25` (D3 : même version majeure partout, CI comprise) ;
- `@types/node` aligné sur `^24` dans le backend et le frontend (le frontend est en `^20`) ;
- retrait de `NEXT_PUBLIC_API_URL`, inutilisée, du `.env` racine. `NEXT_PUBLIC_BACKEND_URL` (frontend) n'est pas concernée.

---

## 3.1 — Finition UI/UX

### N5 — Export CSV (Q4, solde de M14)
- **Périmètre :** transactions et factures uniquement (PRD §4.6).
- **Routes :** `GET /transactions/export` et `GET /invoices/export`, mêmes filtres que la liste correspondante, même scope DM (M13, appliqué dans la requête Prisma), mêmes rôles et permissions que la lecture (`transactions:read`, `invoices:read`) : **aucune nouvelle permission**.
- **Volume :** toutes les lignes correspondant aux filtres, pas seulement la page affichée, dans l'ordre de tri demandé (N6). Plafond : **10 000 lignes** ; au-delà, 400 `BusinessRuleException` « L'export dépasse 10 000 lignes. Affinez les filtres. ».
- **Format :**
  - séparateur `;`, UTF-8 avec BOM, fins de ligne CRLF ;
  - en-têtes de colonnes en français ;
  - dates `AAAA-MM-JJ` (UTC) ;
  - montants en décimal à virgule, sans séparateur de milliers (`1500000,50`), calculés depuis la chaîne décimale sans passer par un nombre flottant ;
  - champs entourés de guillemets si nécessaire, guillemets doublés (RFC 4180) ;
  - **neutralisation de l'injection de formules** : toute cellule commençant par `=`, `+`, `-`, `@`, tabulation ou retour chariot reçoit le préfixe `'`.
- **Réponse :** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="transactions-AAAAMMJJ.csv"` (ou `factures-…`), `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
- **Audit :** `transaction.export` et `invoice.export` (`resourceType` `Transaction` / `Invoice`, `resourceId` `export`), avec les filtres appliqués et le nombre de lignes, sans aucune donnée exportée.

### N6 — Tri par colonne (Q5)
- **Côté serveur** sur tous les tableaux paginés, paramètres `sort` (liste blanche par endpoint) et `order` (`asc` | `desc`). Une valeur hors liste blanche → 400 générique (I17).
- Un tri secondaire stable (identifiant ou clé unique) est toujours ajouté, pour une pagination déterministe.
- Sans `sort`, l'ordre par défaut actuel de chaque endpoint est **inchangé**.
- Listes blanches : voir `design.md` §3.2.
- **Interface :** en-têtes de colonnes cliquables (`aria-sort`, icônes Lucide `ArrowUp`, `ArrowDown`, `ArrowUpDown`), état dans l'URL (`?sort=&order=`), retour à la page 1 à chaque changement de tri.
- `/departments` reste en 6 cartes (AppFlow §3.5), sans tri. Sur `/departments/[id]`, le tableau des employés (non paginé) est trié **côté client**.

### N7 — Navigation responsive (Q6)
- **Mobile (< 768 px) :** tiroir de navigation (drawer) ouvert par un bouton `Menu` de la topbar ; il remplace les icônes de navigation actuelles de la topbar. Fermeture par Échap, clic extérieur, bouton `X` et à chaque navigation ; focus piégé dans le tiroir et rendu au bouton à la fermeture.
- **Tablette (768–1279 px) :** sidebar réduite en icônes (64 px) par défaut.
- **Desktop (≥ 1280 px) :** sidebar 260 px, réductible en icônes (64 px) à la demande.
- Préférence de réduction enregistrée dans `localStorage` (clé `gfep-sidebar`), lue après le montage (aucune dépendance au rendu serveur). En mode icônes, chaque entrée garde un nom accessible et une infobulle (`title`).
- Les entrées restent filtrées par permission (aucune entrée désactivée, AppFlow §4).

### N8 — Thème clair / sombre (Q7)
- Bascule dans la topbar dès 3.1, sur tous les écrans authentifiés ; `/login` et `/login/ad` suivent le thème enregistré.
- Enregistrement dans un **cookie `gfep-theme`** (`light` | `dark`, non httpOnly, `SameSite=Strict`, `Path=/`, 1 an), posé côté client. Le layout racine le lit côté serveur et pose la classe `dark` sur `<html>` : ni flash au chargement, ni script en ligne (compatible avec la CSP de N19).
- Thème par défaut : clair. La préférence du système n'est pas suivie (choix existant de `globals.css`).
- La préférence est attachée au **navigateur**, pas au compte (aucune migration). `/design-system` abandonne sa clé `localStorage` `gfep-theme` au profit du même mécanisme.
- En 3.2, `/profile` réutilise le même contrôle. Le critère de 3.2 « préférence persistée » s'entend : conservée après rechargement, déconnexion et reconnexion sur le même navigateur.

### N9 — Token d'ombre et interdiction des couleurs en dur (Q8)
- Nouveau token `--shadow-card` dans `@theme` : clair `0 1px 3px rgb(0 0 0 / 0.06)`, sombre `0 1px 3px rgb(0 0 0 / 0.4)` (réassigné sous `.dark`). Classe `shadow-card`.
- Les 7 occurrences de `shadow-[0_1px_3px_rgba(0,0,0,0.06)]` sont remplacées par `shadow-card`.
- Un test frontend parcourt `src/` (hors `app/design-system/` et `__tests__/`) et échoue sur `rgba(`, `rgb(`, `gray-`, `slate-`, `zinc-`, `neutral-` ou une couleur hexadécimale dans un fichier `.tsx`/`.ts`.

### N10 — Dashboard SUPER_ADMIN consolidé (Q9)
En plus des cartes existantes (effectif, état des services, comptes récents, activité récente, accès rapides), le SUPER_ADMIN reçoit :
- finance : recettes et dépenses validées du mois, factures en attente (même calcul que l'ACCOUNTANT, M30) ;
- documents en attente de validation, **tous départements** (5 plus récents et nombre total) ;
- répartition des employés actifs par département et 5 dernières embauches (HR) ;
- alertes de sécurité `HIGH` et `CRITICAL` (AUD) et événements de sécurité récents (ITA).
Aucun nouvel endpoint : `GET /dashboard` enrichit la réponse du rôle SUPER_ADMIN.

### N11 — Fiche employé et détail de département (Q10)
- **`/employees/[id]` — « Documents liés »** : documents dont l'employé est propriétaire, filtrés selon M9 pour l'utilisateur connecté ; section affichée si l'utilisateur a `documents:read`. Nouveau filtre `ownerId` sur `GET /documents`.
- **`/employees/[id]` — « Historique »** : entrées d'audit `employee.*` de la fiche (`GET /audit/logs?resourceType=Employee&resourceId=…`, existant), affichées uniquement avec `audit:read` (SA, AUD).
- **(dérivé — à valider)** **`/departments/[id]` — « Ressources documentaires »** (AppFlow §3.5, noté « MVP 2 » dans `PROGRESS.md` 1.5 mais jamais livré) : documents du département (M8), filtrés selon M9 pour l'utilisateur connecté ; section affichée si l'utilisateur a `documents:read`. Nouveau filtre `departmentId` sur `GET /documents`.

### N12 — Corrections actées sans question (application de règles écrites)
- `/finance` redirige vers `/finance/transactions` (côté serveur).
- Sonner : au plus 2 toasts visibles (`visibleToasts={2}`, `04` §4.6) ; erreurs persistantes avec bouton de fermeture.
- Toast de confirmation après chaque action d'écriture réussie qui n'en a pas encore, en particulier création et modification d'employé ; après une création suivie d'une redirection (AppFlow §6), le toast s'affiche sur la page d'arrivée.
- Vue en cartes empilées sur mobile pour la liste des employés (`04` §6), comme les autres listes.
- `design-system.test.tsx` : délai explicite de 30 s pour le test de propriété (100 essais conservés).
- `test/documents.int-spec.ts:228` : typage corrigé (TS18046).

---

### N31 — Mise en œuvre de l'étape 3.1 (2026-11-06)
**Écarts par rapport à `design.md`, justifiés :**
- **Toast après redirection (N12, design §3.4) :** le `Toaster` est monté dans le layout racine, qui reste en place lors d'une navigation côté client. Un toast émis juste avant `router.push` s'affiche donc sur la page d'arrivée (mécanisme déjà utilisé par le dépôt de document). Le relais par `sessionStorage` (`lib/flash.ts`, `FlashToast`) n'a pas été créé : il n'apportait rien.
- **Toasts :** `toast` est réexporté par `components/ui/sonner.tsx`, avec `toast.error` persistant par défaut (`duration: Infinity`). Tous les composants importent `toast` depuis ce module, plus depuis `sonner`.
- **Token d'ombre (N9) :** Tailwind v4 recopie la valeur d'un token `--shadow-*` de `@theme` dans l'utilitaire généré, ce qui ignorerait la valeur sombre. `--shadow-card` est donc défini sur `:root` et `.dark` (couche `base`), et l'utilitaire `shadow-card` est déclaré par `@utility` (`box-shadow: var(--shadow-card)`).
- **Test anti-couleurs (N9) :** `text-white` reste autorisé, car `04` §4.1 impose un texte blanc sur le bouton primaire. Les autres classes de palette Tailwind par défaut (`bg-white`, `red-500`, `gray-*`…) sont interdites.
- **Grille du dashboard SUPER_ADMIN (N10) :** la grille existante de tous les dashboards (1, 2 puis 3 colonnes) est conservée par cohérence entre les rôles, au lieu d'une grille spécifique à 12 colonnes.
- **Tri :** l'état de tri est lu dans l'URL après le montage ; la liste attend cette lecture avant son premier chargement (une seule requête). Sur mobile, un sélecteur « Trier par » remplace les en-têtes de colonnes, absents de la vue en cartes. Les onglets de la console d'audit gardent chacun leurs clés ; une clé d'un autre onglet présente dans l'URL est ignorée.
- **Sidebar :** sans préférence enregistrée, elle est réduite si la fenêtre fait moins de 1 280 px au montage. Le rendu serveur la montre dépliée : sur tablette, l'ajustement a lieu au premier affichage complet d'une page (pas lors des navigations suivantes, le layout restant monté).
- **Audit d'un export (N5) :** les clés `exportFilters` et `exportedRows` sont ajoutées à la liste blanche des types `Transaction` et `Invoice` de l'`AuditService`.
- **Libellés CSV :** les libellés de type et de statut sont dupliqués côté backend (`finance/csv.ts`), identiques à ceux de l'interface (`finance-badges.tsx`).

**Écarts de la revue T3.1.1 corrigés (T3.1.16) :**
- vue en cartes sous 768 px pour les trois onglets de `/admin/audit` et pour `/access/ad-mappings` (`04` §6) ;
- squelettes de chargement pour `/access/roles`, `/access/roles/[id]`, `/documents/[id]` et `/employees/[id]/edit` (`04` §4.8) ;
- fil d'Ariane harmonisé (composant `Breadcrumb`) sur `/documents/[id]` (séparateur « / » propre) et `/finance/invoices/[id]` (bouton retour seul) — AppFlow §4 ;
- page 404 aux couleurs de l'application (`app/not-found.tsx`) au lieu de la page par défaut de Next.

**Test du MVP 2 mis à jour :** `test/finance.int-spec.ts` (« aucune carte finance pour les autres rôles ») excluait le SUPER_ADMIN ; N10 lui donne désormais les cartes finance. Le test le vérifie et garde l'absence pour DM et EMPLOYEE.

---

## 3.2 — Profil et paramètres

### N13 — « Mot de passe oublié » (Q11)
- Option A : sur `/login`, le lien « Mot de passe oublié ? » affiche un message informatif en place (« Contactez le service informatique de GUINEA FINANCE pour réinitialiser votre mot de passe. »), sans nouvelle route ni endpoint. Le message est identique pour tous : il ne révèle rien sur l'existence d'un compte.
- **Vérification demandée (2026-11-06) :** `/access/users` ne permet **pas** de réinitialiser le mot de passe d'un compte. Les routes existantes sont `GET /access/users`, `PUT /access/users/:id/roles`, `PATCH /access/users/:id/status` et `POST /access/users/:id/unlock`.
- **Manque connu, reporté à une phase ultérieure, non bloquant pour le MVP 3 :** aucune réinitialisation administrative du mot de passe d'un compte LOCAL. En laboratoire, la récupération passe par le seed de développement. Une réinitialisation par IT_ADMINISTRATOR / SUPER_ADMIN (mot de passe temporaire, changement obligatoire à la connexion suivante, garde-fous M17) devra être spécifiée.

### N14 — Changement de mot de passe (Q12)
- Route `PATCH /profile/password`, corps `{ currentPassword, newPassword }`, comptes LOCAL uniquement ; compte `ACTIVE_DIRECTORY` → 409 « Le mot de passe d'un compte d'entreprise se gère dans l'annuaire. ».
- **Politique du nouveau mot de passe** (approche NIST, sans règle de composition) :
  - 12 à 128 caractères ;
  - différent du mot de passe actuel ;
  - ne contient ni l'identifiant, ni le prénom, ni le nom (insensible à la casse et aux accents, segments de 3 caractères ou plus) ;
  - absent d'une liste de mots de passe courants embarquée dans le code.
  - Chaque refus de politique → 400 `BusinessRuleException` avec un message précis et actionnable.
- **Mot de passe actuel erroné :** 400 « Mot de passe actuel incorrect. ». Ces échecs ne comptent **pas** dans `failedLoginCount`.
- **Limitation :** throttler nommé `password-change`, 5 essais / 15 min **par compte** (traceur = identifiant du compte), 429 au-delà. En mémoire en 3.2, persistant à partir de 3.3 (N18).
- **Après succès, dans une transaction :** nouveau hash argon2 ; révocation de toutes les autres sessions (la session courante est conservée) ; audit `user.password_change` (nombre de sessions révoquées, aucune valeur de mot de passe) ; notification `SECURITY` à l'utilisateur.
- **M19 étendu :** nouveau déclencheur « changement de mot de passe » → `SECURITY` à l'utilisateur concerné.

### N15 — Permissions du profil (Q13)
- `profile:read` et `profile:update`, attribuées aux 8 rôles. `@AuthenticatedOnly` reste réservé à `/auth/me` et `/auth/logout` (I15).
- `GET /profile` : informations du compte et de la fiche employé de l'utilisateur connecté (lecture seule ; la fiche reste gérée par les RH).
- Seuls le mot de passe et le thème sont modifiables depuis `/profile`.

### N16 — `/admin/settings` (Q14)
- **Migration additive `system_settings`** : modèle `SystemSetting` (`key` clé primaire, `value` JSON, `updatedAt`, `updatedById` nullable vers `users`).
- **Écran :**
  - **configuration effective en lecture seule** : verrouillage (5 échecs / 15 min), limitation de débit des connexions (5 / 15 min / IP), taille maximale et formats des documents, état de l'annuaire (Disponible / Indisponible / Non configuré), version de l'application ;
  - **un seul paramètre modifiable : la durée de session**, entier de 1 à 12 heures, 8 par défaut (C4). Sans ligne en base, la valeur par défaut s'applique.
- La nouvelle durée s'applique aux sessions **créées après** la modification (expiration en base et `maxAge` du cookie) ; les sessions en cours gardent leur expiration.
- Les valeurs fixées par le PRD (5 échecs / 15 min) ne sont pas modifiables.
- Permissions `settings:read` et `settings:write`, **SUPER_ADMIN uniquement** ; routes `GET /admin/settings` et `PATCH /admin/settings`.
- Audit `setting.update` (TRD §7), avec l'ancienne et la nouvelle valeur.

---

## 3.3 — Durcissement sécurité

### N17 — Logs structurés Pino (Q15, solde de M20)
- `nestjs-pino` (compatible Nest 12) et `pino-http`.
- **`requestId` :** UUID v4 toujours généré par le serveur ; un en-tête `X-Request-Id` envoyé par le client est ignoré. Renvoyé dans l'en-tête de réponse `X-Request-Id` et présent dans toutes les lignes de la requête.
- **Masquage (`redact`) :** en-têtes `cookie`, `set-cookie`, `authorization` ; tout champ `password`, `currentPassword`, `newPassword`, `passwordHash`, `token`, `sessionToken`, `sessionTokenHash`.
- **Sortie :** JSON sur la sortie standard ; si `LOG_FILE` est défini, écriture aussi dans ce fichier (TRD §11). Niveau `LOG_LEVEL` (défaut `info`) ; `silent` en test, sauf dans les tests qui capturent les logs.
- **Événements métier :** chaque `AuditLog`, `AuthEvent` et `SecurityEvent` écrit aussi une ligne Pino au format de TRD §7 (`event`, `actorId`, `username`, `authMethod`, `sourceIp`, `timestamp`, `status`, `reason`, `requestId`), **après le commit** de la transaction qui l'a écrit. Une transaction annulée n'émet aucune ligne.

### N18 — Rate limiting et `repeated_forbidden` persistants (Q16, Q17, solde de M20)
- **Migration additive `request_counters`** : modèle `RequestCounter` (`id`, `scope`, `key`, `occurredAt`, `expiresAt`, index `(scope, key, occurredAt)` et `(expiresAt)`).
- **Throttler :** `ThrottlerStorage` PostgreSQL (fenêtre glissante, une ligne par requête comptée), sans Redis (TRD §12). La clé est celle que calcule `@nestjs/throttler` (empreinte SHA-256) : aucune IP en clair dans la table.
- **`repeated_forbidden` :** même table, portée `forbidden`, clé = identifiant du compte ; « un seul événement par fenêtre » se déduit du dernier `SecurityEvent repeated_forbidden` du compte en base.
- Les lignes expirées sont purgées au fil des écritures. Les compteurs survivent à un redémarrage (test dédié).

### N19 — En-têtes de sécurité HTTP (Q18)
- **Backend :** `helmet`, CSP API `default-src 'none'; frame-ancestors 'none'`. Exceptions :
  - `/documents/:id/preview` : `frame-ancestors 'self'` (l'aperçu PDF est affiché dans une `iframe` du frontend, same-origin via les rewrites) ; la CSP `sandbox` existante est conservée ;
  - `/api/docs` (3.5) : CSP assouplie limitée à cette route, en développement uniquement.
- **Frontend :** en-têtes posés par Next (`X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive, `X-Frame-Options: DENY`) et **CSP stricte avec nonce** générée par `middleware.ts` (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `frame-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` ; `'unsafe-eval'` en développement uniquement).
- **Repli autorisé par l'utilisateur :** si le nonce entre en conflit avec ce que Next injecte (next/image, next/script, hydratation) au point de devenir coûteux, bascule sur une CSP statique avec `'unsafe-inline'` pour les scripts, documentée dans `OWASP-REVIEW.md` comme **risque accepté**, et l'utilisateur est prévenu. 3.3 n'est pas bloquée pour ce point.

### N20 — Revue OWASP Top 10 (Q19)
- Livrable `.kiro/specs/gfep-mvp3/OWASP-REVIEW.md` : grille A01–A10 × modules (auth, AD, RBAC, employés, départements, documents, finance, accès, notifications, audit, profil, paramètres, frontend), avec une preuve par case (fichier, test ou commande).
- Balayage de TRD §6 : SQL brut (présent uniquement dans le harnais de test), DTO stricts, autorisations côté serveur, aucun secret dans les logs.
- Tout écart est corrigé dans 3.3 avec un test ; un écart qui demande un changement d'architecture → question à l'utilisateur.

### N21 — `npm audit` (Q20)
- Suppression de `@nestjs/mau` et du script `deploy` (inutilisés).
- `npm audit fix` sans changement de version majeure pour `@nestjs/cli` (`minimatch`) et `typescript-eslint`.
- `next`/`postcss` : `overrides` vers une version corrigée de `postcss`, **sans passer à Next 16**. Si le build casse, risque accepté documenté (dépendance de build).
- Objectif : 0 vulnérabilité.

### N22 — Évaluation de `ldapts` (Q21, M26)
- Non bloquante. Remplacement seulement si : `npm run test:ad` 12/12 deux fois, tests AD sans Docker verts, comportement identique (délai de 3 s, vérification TLS jamais désactivée, correspondance des erreurs), ESM sous Node 24.
- En cas de remplacement : **TRD §8 amendé** (« ldapjs » → « ldapts », autorisé par l'utilisateur), `ldapjs` et `@types/ldapjs` retirés, M26 et le point 9 du bloc « À RÉVISER » mis à jour. Sinon, `ldapjs` est conservé et la raison est documentée.

---

## 3.4 — Tests automatisés

### N23 — Pipeline de CI (Q22)
- `.github/workflows/ci.yml` : Node 24, service `postgres:16`, `npm ci`, `prisma migrate deploy`, lint (vérification des types comprise, N24), build, test, couverture (N27). Sans les tests AD qui demandent Docker (`test:ad`). Le fichier est créé, jamais poussé sans demande.

### N24 — Vérification des types (Q23)
- Script `typecheck` (`tsc --noEmit -p tsconfig.json`) dans le backend (tests compris) et le frontend, enchaîné dans `npm run lint` de chaque application.

### N25 — Exécutions simultanées de la suite backend (Q24)
- `globalSetup` prend un verrou consultatif PostgreSQL (`pg_try_advisory_lock`) sur une connexion gardée ouverte jusqu'au `teardown`. Une seconde exécution échoue immédiatement avec un message explicite (« Une autre exécution de la suite backend est en cours sur cette base de test. »).

### N26 — Tests frontend (Q25)
- Vitest + Testing Library, sans Playwright (TRD §2 : « Playwright ou Vitest »).
- Couverture visée : liste des employés (rendu, tri, vue mobile), liste et détail des départements, dashboard des 8 rôles, navigation (sidebar, tiroir, réduction, bascule de thème), `/profile`, `/admin/settings`, boutons d'export CSV.

### N27 — Couverture de code (Q26)
- `npm run test:cov` (backend) mesure `src/auth/`, `src/rbac/`, `src/access/`, `src/ad-auth/`, `src/security/`, avec des seuils imposés : **80 % des lignes, 70 % des branches**. Exécuté en CI.
- L'accélération de la suite backend (~7 min) est hors périmètre.

---

## 3.5 — Documentation API

### N28 — Swagger / OpenAPI (Q27)
- `@nestjs/swagger` (compatible Nest 12), plugin CLI pour les schémas des DTO.
- **Tous les endpoints** (critère de `06` §3.5).
- `/api/docs` (et `/api/docs-json`) monté **uniquement si `NODE_ENV=development`** ; hors des guards, donc sans session en développement ; 404 en test et en production (test dédié en production).
- Chaque opération documente ses rôles et sa permission, générés depuis les métadonnées `@Roles` / `@Permission` (`@Public`, `@AuthenticatedOnly` signalés), l'authentification par cookie de session, et les erreurs 400 (générique), 401, 403, 404, 409, 429 selon le cas.
- **Preuve du critère :** un test vérifie que chaque route de l'inventaire de `route-access` figure dans le document OpenAPI, avec un schéma de requête quand elle a un corps.

---

## Transverse

### N29 — Catalogue de permissions (30 → 34, dans la fourchette 30–40 de `05` §7)

| Étape | Permissions ajoutées | Total |
|---|---|---|
| MVP 2 | voir M24 | 30 |
| 3.2 | `profile:read`, `profile:update` (8 rôles) ; `settings:read`, `settings:write` (SUPER_ADMIN) | 34 |

Aucune permission nouvelle en 3.1 (export : permissions de lecture, N5), 3.3, 3.4, 3.5.

### N30 — Migrations prévues (M2)

| Étape | Migration | Besoin | Décision |
|---|---|---|---|
| 3.2 | `system_settings` : modèle `SystemSetting` | Durée de session modifiable | N16 |
| 3.3 | `request_counters` : modèle `RequestCounter` | Rate limiting et `repeated_forbidden` persistants | N18 |

Chacune est additive, accompagnée de la mise à jour de `05-Backend-Schema.md` §3, de `schema.spec.ts` et d'une note de mise en œuvre ici.
