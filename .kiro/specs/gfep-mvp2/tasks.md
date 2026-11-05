# Plan d'implémentation — MVP 2 (étapes 2.1 à 2.7)
## Guinea Finance Enterprise Portal (GFEP)

---

## Vue d'ensemble

Le plan suit l'ordre exact de `06-Implementation-Plan.md`. Une étape ne commence que si la tâche « Critère de passage » de l'étape précédente est cochée.

**Notations :**
- `→ R`, `→ T` : exigences de `requirements.md` ;
- `→ M` : décisions de `DECISIONS.md`.

**Règles valables pour chaque étape :**
- `npm run lint`, `npm run build` et `npm test` passent à la racine avant la tâche de critère ;
- `PROGRESS.md` est mis à jour ;
- aucune route sans `@Roles` + `@Permission` (`@Public()` seulement pour `login-ad`) ;
- une migration = une tâche, avec mise à jour de `05` et de `DECISIONS.md` ;
- les cases « validation manuelle utilisateur » ne sont jamais cochées par l'agent.

---

## Étape 2.1 — Jeu de données complet (seed)

- [x] T2.1.1 — Refactorer `prisma/seed-mvp1.ts` en module réutilisable
  - Exporter `MVP1_DATA` et `seedMvp1(prisma, passwordHashes)`.
  - Garder l'exécution autonome et la garde `NODE_ENV=production`.
  - _→ R1.1, M3_
- [x] T2.1.2 — Créer `prisma/seed-data/` (`organisation.ts`, `documents.ts`, `finance.ts`)
  - 18 postes, 40 employés (répartition DG 4, RH 6, CF 8, IT 7, CO 9, AC 6, personnes nommées de M5), 6 catégories, 50 documents, 30 factures, 100 transactions.
  - Données déterministes et fictives.
  - _→ R1.4, R1.5, M5_
- [x] T2.1.3 — Créer `prisma/seed-files.ts` et `prisma/seed-fixtures/` (`template.docx`, `template.xlsx`)
  - Générer de petits fichiers PDF, PNG et JPG valides.
  - Copier les gabarits DOCX et XLSX.
  - Écrire sous `DOCUMENTS_STORAGE_DIR` avec un nom UUID ; ne pas réécrire un fichier existant.
  - _→ R1.8, M10_
- [x] T2.1.4 — Créer `prisma/seed.ts` (seed complet)
  - Garde `NODE_ENV=production`.
  - Un hash argon2 par rôle depuis `SEED_PASSWORD_<ROLE>`.
  - Appel de `seedMvp1()`, puis extension par upserts (clés de design §3.1).
  - Déplacement de Keïta en IT ; `Department.managerId` mis à jour.
  - 40 comptes `LOCAL` avec `EmployeeIdentity` ; rôles : `m.keita` SA, `f.camara` DM, les autres EMP.
  - _→ R1.1–R1.7, M3, M4, M5_
- [x] T2.1.5 — Configuration
  - `package.json` : `prisma.seed` pointe vers `tsx prisma/seed.ts`.
  - `.env.example` : `DOCUMENTS_STORAGE_DIR`, `SEED_PASSWORD_*`.
  - `.gitignore` : `apps/backend/storage/`.
  - _→ R1, M10_
- [x] T2.1.6 — Basculer les tests sur le seed complet
  - `helpers.seedOrThrow()` lance `seed.ts`.
  - Répertoire de stockage temporaire nettoyé dans le `globalSetup`.
  - _→ R2.1, M3_
- [x] T2.1.7 — Mettre à jour les tests MVP 1 dépendant des volumes
  - `modules.int-spec.ts` : totaux, pagination, recherche, effectifs, dashboards.
  - `rbac.int-spec.ts` et `employee-number.int-spec.ts` : numéros attendus.
  - _→ R2.2_
- [x] T2.1.8 — Réécrire `test/seed.int-spec.ts`
  - Volumes R1.4.
  - Idempotence (comptages et fichiers).
  - Refus en production.
  - Chaque document a un fichier dont les magic bytes correspondent à son `mimeType`.
  - Aucun mot de passe en clair dans la sortie.
  - _→ R1.2, R1.3, R2.3_
- [x] T2.1.9 — Critère de passage 2.1
  - `npx prisma db seed` sur la base de dev migrée : aucune erreur.
  - Comptages relevés et comparés à R1.4 (rôles 3 et permissions 6, attendus selon M3).
  - Deuxième exécution sans doublon.
  - `PROGRESS.md` à jour.
  - _→ R3_

---

## Étape 2.2 — Module Documents

- [ ] T2.2.1 — Migration `document_validation_status`
  - Enum `DocumentValidationStatus` et `Document.validationStatus` (défaut `PENDING`).
  - Mise à jour de `05` §3, de `schema.spec.ts` (12 enums) et de `DECISIONS.md`.
  - Extension de seed : statuts répartis.
  - _→ R7.1, T5, M2, M7_
- [ ] T2.2.2 — `AuditModule` global et `AuditService.record(tx, entry)`
  - Liste blanche de champs par type de ressource ; aucun secret.
  - Test unitaire de la liste blanche.
  - _→ R6.2, M12_
- [ ] T2.2.3 — Permissions documents dans le seed
  - `documents:read`, `write`, `share`, `delete` pour SA, DM et EMP.
  - `documents:validate` pour SA et DM.
  - Constante `DOCUMENT_ROLES` dans `rbac/roles.ts`.
  - _→ M24, design §2_
- [ ] T2.2.4 — `document-storage.ts` et `file-signature.ts`
  - Installer `file-type`.
  - Liste blanche PDF, DOCX, XLSX, PNG, JPEG.
  - Contrôle du chemin résolu sous `DOCUMENTS_STORAGE_DIR`.
  - Tests unitaires : signatures valides, exécutable renommé, ZIP non OOXML, chemin hors racine.
  - _→ R5.2, R5.5, M10_
- [ ] T2.2.5 — `document-access.ts`
  - `buildVisibilityWhere(user)`, `canValidate`, `canShare`, `canDelete`.
  - Tests unitaires pour chaque branche de M8 et M9.
  - _→ R4, R7.2, R8, M8, M9, M11_
- [ ] T2.2.6 — DTO et `DocumentsService` : liste, détail, catégories, upload, téléchargement, aperçu
  - Audit `document.view` et `document.download` pour les documents sensibles.
  - En cas d'échec d'insertion, le fichier est supprimé.
  - _→ R4–R6_
- [ ] T2.2.7 — `DocumentsService` : validation, partage et suppression
  - Transactions et audits.
  - Point d'appel de notification prévu (sans effet avant 2.5).
  - _→ R7, R8_
- [ ] T2.2.8 — `DocumentsController`
  - Routes de design §4.3, chacune avec `@Roles(...DOCUMENT_ROLES)` et `@Permission`.
  - Multer en mémoire, limite de 10 Mo.
  - _→ R4–R8, T1_
- [ ] T2.2.9 — Composants ui
  - `ui/dialog.tsx` (`ConfirmDialog`), `ui/file-input.tsx`, `ConfidentialityBadge`, `ValidationBadge`.
  - Tests de mapping des badges et de la modale destructive (pas de fermeture au clic extérieur).
  - _→ T4, design §10_
- [ ] T2.2.10 — Écran `/documents`
  - Liste avec filtres et pagination ; états squelette, vide (avec action), erreur.
  - Entrée « Documents » dans la sidebar.
  - _→ R9.1, R9.5_
- [ ] T2.2.11 — Écran `/documents/[id]`
  - Métadonnées, aperçu, téléchargement, validation, partage, suppression (`ConfirmDialog`), toasts.
  - 403 et 404 distincts.
  - _→ R9.2_
- [ ] T2.2.12 — Écran `/documents/upload`
  - React Hook Form + Zod, catégories avec `canUpload`, redirection et toast.
  - _→ R5, R9.1_
- [ ] T2.2.13 — Dashboard
  - Retrait des cartes « disponible prochainement » (M25).
  - « Mes documents récents » (EMP) et « Documents en attente de validation » (DM), alimentés par l'API.
  - _→ R9.3, R9.4, M25_
- [ ] T2.2.14 — `test/documents.int-spec.ts`
  - Matrice de rôles par route.
  - Visibilité (4 niveaux, propriétaire, partage, département de la catégorie ou du propriétaire).
  - 404 généralisé.
  - Rejets d'upload.
  - Contrôle de catégorie.
  - Validation (scope, 409).
  - Partage et suppression.
  - Audits sensibles uniquement.
  - _→ T2, R4–R8_
- [ ] T2.2.15 — Critère de passage 2.2
  - Test automatisé avec deux EMPLOYEE de départements différents : chacun ne voit que ses documents de département, les documents publics, les siens et ceux qui lui sont partagés.
  - Validation manuelle utilisateur : ☐ (non cochée par l'agent).
  - `PROGRESS.md`.
  - _→ R10_

---

## Étape 2.3 — Module Finance

- [ ] T2.3.1 — Migration `finance_department`
  - `departmentId` nullable, relation et index sur `Transaction` et `Invoice`.
  - Mise à jour de `05` §3 et de `DECISIONS.md`.
  - Extension de seed : `departmentId` réparti.
  - _→ R11.2, T5, M2, M13_
- [ ] T2.3.2 — Seed : rôle ACCOUNTANT
  - Permissions finance selon design §2 (SA, ACC, DM).
  - `ibrahima.sow` reçoit ACC (et perd EMP).
  - `SEED_PASSWORD_ACCOUNTANT`.
  - _→ R11.1, M6_
- [ ] T2.3.3 — Module `finance/` : transactions
  - Liste (scope DM, filtres).
  - Création (référence `TRX-AAAA-NNNNN` en transaction, avec nouvel essai).
  - Changement de statut réservé au SA.
  - Montants en chaîne ; audits.
  - _→ R12, M13, M14_
- [ ] T2.3.4 — Module `finance/` : factures
  - Liste et détail (scope DM, 404).
  - Transitions de M14 ; **transition interdite → 400** ; audit.
  - _→ R13, M14_
- [ ] T2.3.5 — Composants `TransactionStatusBadge`, `InvoiceStatusBadge`, `MoneyAmount`, avec tests
  - _→ T4_
- [ ] T2.3.6 — Écrans `/finance/transactions` et `/finance/transactions/new`
  - Actions Valider / Rejeter (SA, modale) ; toasts.
  - Entrée « Finance » dans la sidebar.
  - _→ R14.1, R14.2_
- [ ] T2.3.7 — Écrans `/finance/invoices` et `/finance/invoices/[id]`
  - Changement de statut limité aux transitions autorisées.
  - _→ R14.1_
- [ ] T2.3.8 — Dashboard ACC
  - Transactions récentes, factures en attente, indicateurs du mois.
  - _→ R14.3_
- [ ] T2.3.9 — `test/finance.int-spec.ts`
  - Matrice SA, ACC, DM, EMP.
  - Scope DM.
  - Validation réservée au SA, 409.
  - Transitions de facture : chaque transition valide, et **chaque transition interdite → 400** (un test par transition).
  - Montants en chaîne.
  - Références concurrentes.
  - Audits.
  - _→ T2, R12, R13_
- [ ] T2.3.10 — Critère de passage 2.3
  - Tests automatisés : ACCOUNTANT plein accès ; DM lecture limitée à son département ; EMPLOYEE 403 et aucune entrée de menu Finance (test de `navItemsFor`).
  - Validation manuelle utilisateur : ☐.
  - `PROGRESS.md`.
  - _→ R15_

---

## Étape 2.4 — RBAC complet (8 rôles)

- [ ] T2.4.1 — Seed : rôles IT_ADMINISTRATOR, IT_TECHNICIAN, HR_MANAGER, AUDITOR
  - Permissions `employees:status`, `roles:*` et `users:*`.
  - Matrice complète de design §2.
  - `SEED_PASSWORD_*` correspondants.
  - _→ R16.1, M5, M24_
- [ ] T2.4.2 — Seed : réattribution des comptes (M5)
  - `t.balde` SA, `m.keita` ITA, `f.camara` HR, `a.barry` DM, `s.toure` AUD, `f.kaba` ITT.
  - L'ancien rôle est retiré à chaque fois.
  - _→ R16.2, M5_
- [ ] T2.4.3 — Constantes de rôles et mise à jour des `@Roles` de toutes les routes existantes
  - Routes : dashboard, employees, departments, documents, finance.
  - Selon la matrice.
  - _→ R16.3_
- [ ] T2.4.4 — Mettre à jour les tests MVP 1 (Q3)
  - `CREDENTIALS` dans `helpers.ts` : SA = `t.balde`, DM = `a.barry` (AC), plus les 5 nouveaux rôles.
  - Fichiers : `rbac`, `modules`, `lockout`, `employee-number`, `validation`.
  - Changements consignés dans `PROGRESS.md`.
  - _→ R16.4, M5_
- [ ] T2.4.5 — **Report T2.4.R1 (backend)** : `PATCH /employees/:id/status`
  - Scope DM ; pas soi-même.
  - Transaction : employé + `User` `SUSPENDED` + sessions révoquées + audit.
  - La réactivation ne concerne que la fiche employé.
  - _→ R17.1–R17.4, M16_
- [ ] T2.4.6 — **Report T2.4.R1 (frontend)** : boutons « Suspendre » et « Réactiver » sur `/employees/[id]`
  - `ConfirmDialog` destructif, avec l'option « Sortie définitive ».
  - Toasts ; rendu selon `canChangeStatus`.
  - _→ R17.5_
- [ ] T2.4.7 — Module `access/` : rôles
  - Liste, détail.
  - `PUT /access/roles/:id/permissions` réservé au SA, avec les garde-fous de M18.
  - Audit.
  - Point d'appel de notification (sans effet avant 2.5).
  - _→ R19, M18_
- [ ] T2.4.8 — Module `access/` : comptes
  - Liste, attribution de rôles, suspension et réactivation.
  - Garde-fous de M17 ; compte AD → 409 ; audits.
  - **Dernier SA actif** : ni suspendu, ni réactivé, ni rétrogradé par un tiers (403).
  - _→ R18.1–R18.5, M17_
- [ ] T2.4.9 — **Report T2.4.R2** : `POST /access/users/:id/unlock`
  - `LOCKED` uniquement.
  - `ACTIVE` et `failedLoginCount = 0`.
  - Garde-fous de M17 ; audit `user.unlock`.
  - Le verrouillage automatique du dernier SA actif suit I14 ; le déverrouillage manuel via cet endpoint ne s'applique pas à ce compte. Sa récupération est l'expiration après 15 minutes ou le seed de développement ; aucun script CLI n'est prévu.
  - Prévoir l'alerte `WARNING` aux ITA actifs (effective en 2.5) et le `SecurityEvent account_locked` de sévérité `HIGH` (effectif en 2.6) à chaque verrouillage de ce compte.
  - _→ R18.1, R18.5, M17, I14_
- [ ] T2.4.10 — Écrans `/access/users`, `/access/roles`, `/access/roles/[id]`
  - `ui/checkbox.tsx` et `AccountStatusBadge`.
  - Entrée « Accès » dans la sidebar.
  - _→ R20_
- [ ] T2.4.11 — Dashboards par rôle
  - HR : effectif, répartition (Recharts), dernières embauches.
  - ITA : comptes récents, état des services.
  - ITT : état des services.
  - SA : vue consolidée.
  - AUD : « Mes informations » jusqu'en 2.6.
  - Composant `ServiceStatusCard`.
  - _→ R16.5, M15, M20, M25_
- [ ] T2.4.12 — Tests
  - `access.int-spec.ts` : matrice et **un test par garde-fou** de M17 et M18 ; déverrouillage ; la suspension révoque les sessions.
  - `employee-status.int-spec.ts` : atomicité, scope DM, soi-même, réactivation.
  - `last-admin.int-spec.ts` : dernier SA actif non suspendu ni rétrogradé par un tiers ; verrouillé au cinquième échec consécutif, puis déverrouillé à l'expiration de 15 minutes ; rate limiting par IP toujours actif ; le verrouillage s'applique aussi s'il existe plusieurs SA actifs.
  - _→ T2, R17–R19_
- [ ] T2.4.13 — Critère de passage 2.4
  - `test/roles-matrix.int-spec.ts` : pour chacun des 8 rôles, au moins un endpoint représentatif par module (dashboard, employés, départements, documents, finance, accès), avec le résultat attendu, et le contenu du dashboard propre au rôle.
  - Validation manuelle utilisateur : ☐.
  - `PROGRESS.md`.
  - _→ R21_

---

## Étape 2.5 — Notifications

- [ ] T2.5.1 — Seed : permissions `notifications:read` et `notifications:update` pour les 8 rôles
  - _→ M24_
- [ ] T2.5.2 — `NotificationsService.notify(tx, userIds, payload)` et module `notifications/`
  - Liste (propre à l'utilisateur, filtre lu ou non lu), compteur, marquer comme lu, tout marquer comme lu.
  - Autrui → 404.
  - _→ R22_
- [ ] T2.5.3 — Brancher les déclencheurs de M19
  - Points d'appel :
    - connexion (nouvel appareil, sauf à la première connexion) ;
    - partage de document ;
    - attribution de rôle ;
    - modification de la matrice ;
    - verrouillage de compte (`WARNING` aux ITA), notamment du dernier SUPER_ADMIN actif conformément à M17 ;
    - création d'un employé avec responsable.
  - _→ R23, M19_
- [ ] T2.5.4 — Frontend
  - Badge réel dans la topbar.
  - Écran `/notifications` (filtres, icônes Lucide par type, tout marquer comme lu).
  - Carte « Mes notifications » (EMP).
  - _→ R24_
- [ ] T2.5.5 — `test/notifications.int-spec.ts`
  - 8 rôles.
  - Isolation.
  - Chaque déclencheur.
  - Pas d'alerte à la première connexion.
  - _→ T2, R22, R23_
- [ ] T2.5.6 — Critère de passage 2.5
  - Test automatisé : un partage de document produit une notification visible par le destinataire (API).
  - Validation manuelle utilisateur sur `/notifications` : ☐.
  - `PROGRESS.md`.
  - _→ R25_

---

## Étape 2.6 — Administration et audit

- [ ] T2.6.1 — Seed : permissions `audit:read` et `security_events:read` (SA, AUD), `documents:history` (SA, AUD)
  - _→ M24_
- [ ] T2.6.2 — Compléter l'audit des actions héritées du MVP 1
  - Création et modification d'employé.
  - Valeurs avant et après, sans secret.
  - _→ R26.1, M12_
- [ ] T2.6.3 — `SecurityEventsService`
  - `account_locked` (dans `registerFailedAttempt` ; sévérité `HIGH` pour le dernier SUPER_ADMIN actif selon M17).
  - `ForbiddenAuditFilter` global pour `repeated_forbidden` (fenêtre glissante de 5 minutes, un seul événement par fenêtre).
  - _→ R27, M20_
- [ ] T2.6.4 — Endpoints
  - `/audit/logs`, `/audit/security-events`, `/audit/auth-events`, `/documents/:id/history`.
  - Filtres et pagination.
  - Aucune route d'écriture.
  - _→ R26.2, R28_
- [ ] T2.6.5 — Écran `/admin/audit`
  - `ui/tabs.tsx`, trois onglets, filtres, panneau de détail.
  - `/admin` redirige vers `/admin/audit`.
  - Entrée « Audit » dans la sidebar.
  - Historique sur `/documents/[id]`.
  - _→ R28.1–R28.4_
- [ ] T2.6.6 — Dashboards
  - SA : « Activité récente ».
  - AUD : derniers audits et alertes de sécurité.
  - ITA : événements de sécurité récents.
  - _→ R28.5, M25_
- [ ] T2.6.7 — `test/audit.int-spec.ts`
  - Matrice (ITA → 403).
  - Filtres.
  - **Immutabilité prouvée** : inventaire des routes d'écriture (POST, PUT, PATCH, DELETE) ; aucune ne modifie ni ne supprime un `AuditLog` (nombre et contenu inchangés) ; seules des routes GET sous `/audit`.
  - `account_locked` et `repeated_forbidden` (horloge simulée), dont la sévérité `HIGH` pour le dernier SUPER_ADMIN actif.
  - Notification `WARNING` aux ITA pour chaque verrouillage, dont celui du dernier SUPER_ADMIN actif.
  - _→ T2, R26–R28, M21_
- [ ] T2.6.8 — Critère de passage 2.6
  - Test automatisé : une action de chaque type de R26.1, réalisée via l'API, produit une entrée d'audit correspondante, sans champ secret.
  - Validation manuelle utilisateur sur `/admin/audit` : ☐.
  - `PROGRESS.md`.
  - _→ R29_

---

## Étape 2.7 — Authentification Active Directory (LDAP de test)

- [ ] T2.7.0 — Décision préalable sur `ldapjs`, sur preuve
  - **Essai de compatibilité** de `ldapjs` avec **Node 24 et l'ESM** du backend :
    - import ESM et types ;
    - bind LDAPS et recherche contre le LDAP de test ;
    - timeout de 3 s ;
    - avertissements de dépréciation.
  - Résultat documenté dans `DECISIONS.md` (M26).
  - Puis décision : garder `ldapjs` (TRD §8) ou amender le TRD.
  - _→ M26_
- [ ] T2.7.1 — Migration `ad_auth_event_types`
  - 5 valeurs d'enum `AuthEventType`.
  - Mise à jour de `05` §3, de `schema.spec.ts` et de `DECISIONS.md`.
  - _→ T5, M2, M23_
- [ ] T2.7.2 — Infrastructure LDAP de test
  - Service `ldap-test` dans `docker-compose.yml` (profil `ad-test`, `127.0.0.1:636`, TLS obligatoire, overlay `memberOf`).
  - `infra/ldap-test/` : `bootstrap.ldif`, `generate-certs.sh`, `README.md`.
  - _→ R30_
- [ ] T2.7.3 — `prisma/seed-ad-test.ts` (`npm run seed:ad-test`, refuse la production)
  - Fiches Employee de test sans compte local.
  - Mappings `GFEP-*`.
  - _→ R30, M23_
- [ ] T2.7.4 — `ad-config.ts` (variables de design §9.1, validées)
  - Une variable manquante rend l'AD indisponible.
  - `.env.example`.
  - _→ R31.2_
- [ ] T2.7.5 — `ldap-client.ts`
  - Interface `LdapClient` et implémentation (LDAPS, CA, timeout de 3 s, fermeture systématique).
  - Échappement RFC 4515.
  - _→ R31.6, M26_
- [ ] T2.7.6 — `AdAuthService.login`
  - Flux de design §9.3.
  - Un `AuthEvent` par étape ; `SecurityEvent ad_unreachable`.
  - Défauts sûrs.
  - Upsert, synchronisation des rôles et session en transaction.
  - Notification « nouvel appareil ».
  - `TODO(AD-REVISION)` sur chaque point ouvert.
  - _→ R31.3–R31.7, M23_
- [ ] T2.7.7 — `POST /auth/login-ad`
  - `@Public()` (justification en commentaire).
  - Throttler `login-ad` (5 tentatives / 15 min / IP).
  - Ajout aux routes publiques autorisées de `route-access.int-spec.ts`.
  - _→ R31.1, T1_
- [ ] T2.7.8 — Seed : permissions `ad_mappings:read` et `ad_mappings:write` (SA, ITA)
  - Module des mappings : liste, création, suppression.
  - Garde-fou SUPER_ADMIN ; audit.
  - _→ R32, M22, M24_
- [ ] T2.7.9 — Frontend
  - `/login/ad` : vrai formulaire avec ses messages.
  - `/access/ad-mappings`.
  - État LDAP dans `ServiceStatusCard`.
  - _→ R32, R33_
- [ ] T2.7.10 — Tests sans Docker (`npm test`)
  - `ad-auth.service.spec.ts` (`LdapClient` simulé : chaque branche, `AuthEvent` attendus, aucun repli local, échappement).
  - `ad-mappings.int-spec.ts` (matrice et garde-fou).
  - _→ T2, R34.2_
- [ ] T2.7.11 — Tests contre le LDAP Docker (`npm run test:ad`)
  - Succès avec mapping.
  - Deuxième connexion par GUID.
  - Chaque cas de refus.
  - Conteneur arrêté → 503, `AD_UNREACHABLE` et `SecurityEvent`.
  - _→ R34.1_
- [ ] T2.7.12 — Revue AD
  - Lister les `TODO(AD-REVISION)` du code.
  - Vérifier qu'ils correspondent au bloc « À RÉVISER APRÈS MISE EN PLACE DE L'AD » de `DECISIONS.md`.
  - _→ M23_
- [ ] T2.7.13 — Critère de passage 2.7
  - `npm run test:ad` passe : connexion réussie via le LDAP de test, mapping groupe → rôle fonctionnel, refus propre (`AD_UNREACHABLE`) quand le LDAP est arrêté.
  - Validation manuelle utilisateur sur `/login/ad` : ☐.
  - `PROGRESS.md`.
  - _→ R34_

---

## Notes

- Les reports du MVP 1 sont intégrés à l'étape 2.4 :
  - T2.4.R1 (statut employé et bouton « Suspendre ») : T2.4.5 et T2.4.6 ;
  - T2.4.R2 (déverrouillage manuel) : T2.4.9.
- Reportés hors MVP 2 :
  - export CSV finance : 3.1 (M14) ;
  - `/admin/settings`, `/profile`, bascule de thème : 3.2 ;
  - logs Pino et `requestId` : 3.3 (M20) ;
  - Swagger : 3.5.
- Les entrées « (dérivé) » de `DECISIONS.md` ont été validées le 2026-11-05, avec 5 ajouts intégrés : dernier SA actif (M17), transitions de facture en 400 (M14), test d'immutabilité de l'audit (M12), essai `ldapjs` (M26), dette du compteur 403 (M20).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "step": "2.1", "tasks": ["T2.1.1", "T2.1.2", "T2.1.3"] },
    { "id": 1, "step": "2.1", "tasks": ["T2.1.4", "T2.1.5"] },
    { "id": 2, "step": "2.1", "tasks": ["T2.1.6", "T2.1.7", "T2.1.8"] },
    { "id": 3, "step": "2.1", "tasks": ["T2.1.9"] },
    { "id": 4, "step": "2.2", "tasks": ["T2.2.1", "T2.2.2", "T2.2.3", "T2.2.4", "T2.2.5"] },
    { "id": 5, "step": "2.2", "tasks": ["T2.2.6", "T2.2.7", "T2.2.9"] },
    { "id": 6, "step": "2.2", "tasks": ["T2.2.8"] },
    { "id": 7, "step": "2.2", "tasks": ["T2.2.10", "T2.2.11", "T2.2.12", "T2.2.13", "T2.2.14"] },
    { "id": 8, "step": "2.2", "tasks": ["T2.2.15"] },
    { "id": 9, "step": "2.3", "tasks": ["T2.3.1", "T2.3.2", "T2.3.5"] },
    { "id": 10, "step": "2.3", "tasks": ["T2.3.3", "T2.3.4"] },
    { "id": 11, "step": "2.3", "tasks": ["T2.3.6", "T2.3.7", "T2.3.8", "T2.3.9"] },
    { "id": 12, "step": "2.3", "tasks": ["T2.3.10"] },
    { "id": 13, "step": "2.4", "tasks": ["T2.4.1", "T2.4.2", "T2.4.3"] },
    { "id": 14, "step": "2.4", "tasks": ["T2.4.4", "T2.4.5", "T2.4.7", "T2.4.8", "T2.4.9"] },
    { "id": 15, "step": "2.4", "tasks": ["T2.4.6", "T2.4.10", "T2.4.11", "T2.4.12"] },
    { "id": 16, "step": "2.4", "tasks": ["T2.4.13"] },
    { "id": 17, "step": "2.5", "tasks": ["T2.5.1", "T2.5.2"] },
    { "id": 18, "step": "2.5", "tasks": ["T2.5.3", "T2.5.4", "T2.5.5"] },
    { "id": 19, "step": "2.5", "tasks": ["T2.5.6"] },
    { "id": 20, "step": "2.6", "tasks": ["T2.6.1", "T2.6.2", "T2.6.3"] },
    { "id": 21, "step": "2.6", "tasks": ["T2.6.4", "T2.6.5", "T2.6.6", "T2.6.7"] },
    { "id": 22, "step": "2.6", "tasks": ["T2.6.8"] },
    { "id": 23, "step": "2.7", "tasks": ["T2.7.0", "T2.7.1", "T2.7.2", "T2.7.4"] },
    { "id": 24, "step": "2.7", "tasks": ["T2.7.3", "T2.7.5", "T2.7.8"] },
    { "id": 25, "step": "2.7", "tasks": ["T2.7.6", "T2.7.7", "T2.7.9", "T2.7.10"] },
    { "id": 26, "step": "2.7", "tasks": ["T2.7.11", "T2.7.12"] },
    { "id": 27, "step": "2.7", "tasks": ["T2.7.13"] }
  ]
}
```
