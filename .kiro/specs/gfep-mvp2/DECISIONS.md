# DECISIONS — MVP 2 (étapes 2.1 à 2.7)

Ce fichier complète `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md` (Phase 0 et MVP 1, entrées C1–C4, D1–D10, I1–I22), toujours en vigueur. Les entrées ci-dessous sont numérotées M1, M2… Leur source est indiquée : réponse de l'utilisateur (Q0–Q19 et clarifications du 2026-11-05), document de référence, ou règle dérivée.

Les entrées marquées **(dérivé — validé le 2026-11-05)** ne viennent d'aucun document ni d'aucune réponse explicite. Je les ai déduites des règles générales (interdiction par défaut, aucune vulnérabilité, sécurité). Elles ont été confirmées par l'utilisateur lors de la validation de cette spec, le 2026-11-05.

---

## Cadre

### M1 — Périmètre et ordre
- Le MVP 2 suit l'ordre exact de `06-Implementation-Plan.md` : 2.1 → 2.7, sans réordonnancement, fusion ni saut.
- Une étape ne commence que si le critère de passage de la précédente est vérifié concrètement.
- Aucune vulnérabilité volontaire, aucun `LAB_MODE` / `APP_MODE`, aucun vrai Active Directory.
  - **Note — contradiction ouverte :** l'étape 3.3 de `06-Implementation-Plan.md` demande de mettre en place le flag `APP_MODE` (TRD §4). M1 l'exclut pour le MVP 2 uniquement. Le sort d'`APP_MODE` en 3.3 est **à trancher avant l'étape 3.3**, pas maintenant.
- Les règles de `gfep-lot0-mvp1/DECISIONS.md` restent valables, en particulier :
  - I15 : interdiction par défaut ;
  - I17 : 400 génériques ;
  - I14 : verrouillage temporaire.

### M2 — Migrations Prisma additives (Q1)
- Les migrations sont autorisées au cas par cas, **jamais destructives** : ajout de colonne nullable ou avec défaut, ajout de valeur d'enum, ajout d'index ou de relation. Jamais de suppression ni de renommage.
- Une migration par besoin, chacune accompagnée de la mise à jour de `05-Backend-Schema.md` §3 et d'une entrée dans ce fichier.
- Migrations prévues :

| Étape | Migration | Besoin | Décision |
|---|---|---|---|
| 2.2 | `document_validation_status` : enum `DocumentValidationStatus` (`PENDING`, `VALIDATED`, `REJECTED`) + `Document.validationStatus` (défaut `PENDING`) | Validation des documents | M7 |
| 2.3 | `finance_department` : `Transaction.departmentId` et `Invoice.departmentId` nullables, relation vers `Department`, index | Lecture limitée au département du Department Manager | M13 |
| 2.7 | `ad_auth_event_types` : valeurs `AD_SERVICE_BIND_FAILED`, `AD_USER_NOT_FOUND`, `AD_NO_EMPLOYEE_MATCH`, `AD_NO_ROLE_MAPPING`, `AD_LOCAL_ACCOUNT_CONFLICT` ajoutées à `AuthEventType` | Un événement distinct par étape du flux AD | M23 |

---

## 2.1 — Seed complet

### M3 — Le seed complet étend seed-mvp1 (Q2-a, Q4)
- `prisma/seed.ts` est le **seed complet**, déclaré dans `package.json` (`prisma.seed`).
- Il réutilise le jeu de données MVP 1 : `seed-mvp1.ts` est refactoré en module de données et de fonctions exportées. Il complète ensuite ce jeu jusqu'aux volumes de `05` §7, avec des `upsert` sur les clés uniques, donc **aucun doublon**.
- Il refuse `NODE_ENV=production`, comme I11.
- **Rôles :** l'étape 2.1 garde les **3 rôles** MVP 1 et leurs 6 permissions. Le seed s'étend ensuite :
  - 2.2 : permissions documents ;
  - 2.3 : rôle ACCOUNTANT et permissions finance (M6) ;
  - 2.4 : 4 autres rôles et permissions ;
  - 2.5 à 2.7 : permissions restantes.
- **Volumes `05` §7 :**
  - atteints dès 2.1 : départements, postes, employés, utilisateurs, catégories, documents, factures, transactions ;
  - atteints en 2.4 : rôles (8) ;
  - atteints en 2.7 : permissions (30, voir M24).
- À partir de 2.1, **tous les tests d'intégration utilisent le seed complet**. Les tests MVP 1 dont les valeurs attendues dépendent des volumes (totaux, effectifs, recherche) sont mis à jour en 2.1.

### M4 — Mots de passe de démonstration (Q4)
- Un mot de passe de démo **par rôle**, surchargeable par la variable d'environnement `SEED_PASSWORD_<ROLE>`, comme en MVP 1.
- Un seul hash argon2 est calculé par rôle à chaque exécution.
- Tous les comptes du seed sont `LOCAL`. Les comptes AD n'existent que pour les tests AD de 2.7 (M23).

### M5 — Alignement des personas sur PRD §3 (Q3 + clarifications)
**Données (étape 2.1) :**
- Nouvel employé **Thierno Baldé**, Directeur général (DG), responsable du département DG.
- **Mohamed Keïta** (GF-2026-004) passe au département IT, poste « Administrateur systèmes ».
- Nouvel employé **Ibrahima Sow**, Comptable (CF). C'est une personne distincte d'**Ibrahim Sow** (GF-2026-003, responsable IT), qui ne change pas.
- Nouvel employé **Souleymane Touré**, Auditeur (AC).
- Nouvel employé **Fodé Kaba**, Technicien support (IT).

**Comptes et rôles :**

| Compte | Avant | 2.1 | 2.3 | 2.4 |
|---|---|---|---|---|
| `m.keita` | SUPER_ADMIN | SUPER_ADMIN | SUPER_ADMIN | **IT_ADMINISTRATOR** |
| `f.camara` | DEPARTMENT_MANAGER (RH) | inchangé | inchangé | **HR_MANAGER** |
| `m.diallo` | EMPLOYEE | inchangé | inchangé | inchangé |
| `t.balde` (Direction) | — | EMPLOYEE | EMPLOYEE | **SUPER_ADMIN** |
| `ibrahima.sow` | — | EMPLOYEE | **ACCOUNTANT** | ACCOUNTANT |
| `a.barry` | — | EMPLOYEE | EMPLOYEE | **DEPARTMENT_MANAGER** (AC) |
| `s.toure` | — | EMPLOYEE | EMPLOYEE | **AUDITOR** |
| `f.kaba` | — | EMPLOYEE | EMPLOYEE | **IT_TECHNICIAN** |
| autres comptes | — | EMPLOYEE | EMPLOYEE | EMPLOYEE |

- **Identifiants :** `initiale.nom`, en minuscules et sans accents. En cas de collision, on utilise `prenom.nom` (ex. `ibrahima.sow`, car `i.sow` est réservé à Ibrahim Sow).
- **Tests MVP 1 :** ceux qui supposent `m.keita` = SUPER_ADMIN ou `f.camara` = DEPARTMENT_MANAGER sont mis à jour **dans l'étape 2.4** (Q3) :
  - SUPER_ADMIN devient `t.balde` ;
  - le scope Department Manager passe sur `a.barry` (département AC).

### M6 — ACCOUNTANT créé dès 2.3 (clarification)
- Le critère de passage de 2.3 exige « Accountant plein accès ». L'étape 2.3 crée donc le rôle **ACCOUNTANT** et ses permissions finance, et l'attribue à `ibrahima.sow`.
- L'étape 2.4 crée les **4** rôles restants : IT_ADMINISTRATOR, IT_TECHNICIAN, HR_MANAGER, AUDITOR.
- Cela précise la réponse Q2 (« 2.4 crée les 5 autres »).

---

## 2.2 — Documents

### M7 — Validation des documents (Q5 + clarification)
- Migration `document_validation_status` (M2).
- Un document déposé est `PENDING`. Il passe à `VALIDATED` ou `REJECTED` par décision :
  - du **DEPARTMENT_MANAGER du département du document** (M8) ;
  - ou du **SUPER_ADMIN**.
- **Le statut est informatif :** la visibilité suit uniquement M8 et M9.
- Chaque validation ou rejet écrit une entrée d'audit `document.validate`.
- La carte « Documents en attente de validation » du dashboard Department Manager liste les documents `PENDING` de son département.

### M8 — Département d'un document (Q6)
- Département d'un document = `category.departmentId`, à défaut `owner.departmentId`.

### M9 — Visibilité selon la confidentialité (Q7)
Un utilisateur qui a la permission `documents:read` voit un document si l'une des conditions suivantes est remplie :
- il est SUPER_ADMIN ;
- il est le **propriétaire** du document ;
- le document est `PUBLIC` ;
- le document est `INTERNAL` **et** le département de l'utilisateur est celui du document ;
- il détient une `DocumentPermission` explicite sur ce document (READ, WRITE ou DELETE ; toute permission explicite implique la lecture).

Pour un document `CONFIDENTIAL` ou `RESTRICTED`, l'accès passe **uniquement** par une permission explicite, sauf pour le propriétaire et le SUPER_ADMIN.

Un document non visible renvoie **404**, et non 403 : son existence n'est pas révélée.

### M10 — Stockage et formats (Q8)
**Stockage :**
- Disque local, répertoire défini par `DOCUMENTS_STORAGE_DIR`. Par défaut `apps/backend/storage/documents`, ignoré par git.
- Nom de fichier interne : UUID aléatoire, sans extension fournie par l'utilisateur. Le chemin résolu doit rester dans le répertoire de stockage.

**Taille et formats :**
- **10 Mo maximum.**
- Formats acceptés : PDF, DOCX, XLSX, PNG, JPG.
- La détection se fait par **magic bytes**, avec inspection de la structure OOXML pour DOCX et XLSX via la bibliothèque `file-type`. Le nom, l'extension et le type MIME déclarés par le client sont ignorés.
- Le `mimeType` stocké est celui détecté.

**Aperçu et téléchargement :**
- Aperçu `inline` pour PDF, PNG et JPG uniquement.
- Les autres formats sont téléchargés en `attachment`, avec l'en-tête `X-Content-Type-Options: nosniff`.

**Seed :** les 50 documents du seed créent de petits fichiers réels :
- PDF, PNG et JPG générés par programme ;
- DOCX et XLSX copiés depuis deux gabarits minimaux versionnés dans `prisma/seed-fixtures/`.

### M11 — Dépôt, partage, suppression (clarifications)
- **Dépôt :** tout rôle ayant accès aux documents (tous sauf IT_TECHNICIAN, M15). La catégorie doit appartenir à **son département** ou n'avoir **aucun département**. Le SUPER_ADMIN peut déposer dans toute catégorie.
- **Partage** (accorder ou retirer une `DocumentPermission`) : le propriétaire et le SUPER_ADMIN. Le bénéficiaire reçoit une notification `DOCUMENT_SHARED` à partir de 2.5.
- **Suppression** : le propriétaire, les titulaires d'une permission `DELETE` sur le document et le SUPER_ADMIN.
  - Une modale de confirmation est obligatoire (`04` §4.1).
  - Le fichier est supprimé du disque.
  - Une entrée d'audit `document.delete` est écrite.
- La permission `WRITE` n'ouvre aucune action supplémentaire en MVP 2 : AppFlow ne prévoit pas d'édition des métadonnées. Elle implique seulement la lecture.

### M12 — Audit à partir de 2.2 (Q9)
- Un `AuditService` est créé en 2.2. Dès 2.2, il écrit `document.view` et `document.download` pour les documents `CONFIDENTIAL` et `RESTRICTED` (TRD §7 et PRD §4.5 : documents « confidentiels » / « sensibles »), ainsi que `document.delete`, `document.validate` et `document.share`.
- **Chaque étape suivante** écrit les entrées d'audit des actions sensibles qu'elle introduit (TRD §7).
- L'étape 2.6 :
  - ajoute les entrées manquantes (création et modification d'employé, héritées du MVP 1) ;
  - livre l'écran `/admin/audit` et l'historique de consultation sur la fiche document ;
  - vérifie l'exhaustivité.
- **Un test d'intégration prouve qu'aucune route ne modifie ni ne supprime un `AuditLog`** (inventaire des routes et tentative sur chaque route d'écriture ; ajout validé le 2026-11-05).
- L'écriture est **synchrone, dans la même transaction que l'action** quand l'action est transactionnelle (exigée par Q13). Le TRD §3.4 « asynchrone » vise les logs structurés (Pino), reportés à 3.3 (M20).
- Les journaux sont **immuables** : aucune route de modification ni de suppression. Pour le SUPER_ADMIN, « gestion » (AppFlow §3.10) se limite au filtrage. **(dérivé — validé le 2026-11-05)**

### M28 — Mise en œuvre de T2.2.1
- La migration additive `document_validation_status` ajoute `DocumentValidationStatus` et `Document.validationStatus` avec le défaut `PENDING`.
- Le seed attribue de façon déterministe les trois statuts aux documents de démonstration ; aucun compte exact n'est imposé par M7.

### M29 — Destinataires du partage documentaire (clarification utilisateur)
- Pour fournir le sélecteur de comptes de la fiche document sans avancer l'écran `/access/users` de 2.4, 2.2 ajoute `GET /documents/:id/share-recipients`.
- La route exige `documents:share` et ne retourne des destinataires qu'au propriétaire du document ou au SUPER_ADMIN. Elle exclut le compte appelant et renvoie uniquement l'identifiant, l'identifiant de connexion et le nom de l'employé.

---

## 2.3 — Finance

### M13 — Département des transactions et factures (Q10)
- Migration `finance_department` (M2).
- Le DEPARTMENT_MANAGER ne voit que les transactions et factures **dont `departmentId` est celui de son département**. Les lignes sans département ne lui sont jamais visibles.
- Le `departmentId` est obligatoire à la création d'une transaction.

### M14 — Opérations finance ; export CSV reporté à 3.1 (Q11)
**Factures :**
- En **lecture seule**, sauf le **changement de statut** par l'ACCOUNTANT et le SUPER_ADMIN.
- Transitions autorisées **(dérivé — validé le 2026-11-05)** : `DRAFT→SENT`, `SENT→PAID`, `SENT→OVERDUE`, `OVERDUE→PAID`, et `DRAFT|SENT|OVERDUE→CANCELLED`. `PAID` et `CANCELLED` sont finaux.
- **Une transition interdite renvoie 400** (`BusinessRuleException`, message métier), avec un test par transition interdite (ajout validé le 2026-11-05).

**Transactions :**
- Création par l'ACCOUNTANT et le SUPER_ADMIN, au statut `PENDING`.
- **Validation ou rejet par le SUPER_ADMIN uniquement**, et seulement depuis `PENDING`.
- Référence générée au format `TRX-{AAAA}-{NNNNN}`, avec la même méthode que `employeeNumber` (I16) **(dérivé — validé le 2026-11-05)**.

**Export :**
- L'**export CSV** (PRD §4.6) est **reporté à l'étape 3.1** et noté dans la ligne 3.1 de `PROGRESS.md`.

**Montants :**
- `Decimal(14,2)` en base, sérialisés en **chaîne** dans l'API pour éviter les arrondis flottants.
- Devise `GNF`, affichée au format `fr-FR`.

### M30 — Mise en œuvre de l'étape 2.3 (2026-11-05)
**Migration et seed (T2.3.1) :**
- La migration additive `finance_department` ajoute `departmentId` (nullable, index, clé étrangère vers `departments`) à `transactions` et `invoices`. `05-Backend-Schema.md` §3 et `schema.spec.ts` sont mis à jour.
- Le seed rattache chaque facture et chaque transaction à un département, à tour de rôle (DG, RH, CF, IT, CO, AC) : 5 factures et 16 ou 17 transactions par département. Aucune ligne du seed n'est sans département ; ce cas est couvert par les tests.

**Rôle ACCOUNTANT (T2.3.2) :**
- Mot de passe de démonstration par défaut `GF_Acc2026!`, surchargeable par `SEED_PASSWORD_ACCOUNTANT` (ajouté à `.env.example`), comme M4.
- Permissions attribuées dès 2.3 selon la matrice finale (design §2) : `dashboard:read`, `employees:read`, `departments:read`, `documents:read/write/share/delete`, `transactions:read/write`, `invoices:read/status` (11).
- **Écart nécessaire :** `ibrahima.sow` perd EMPLOYEE (M6). Sans ces permissions et sans ACCOUNTANT dans les `@Roles` des routes de lecture existantes, il n'aurait plus accès au dashboard (T2.3.8). ACCOUNTANT est donc ajouté dès 2.3 aux routes dashboard, `GET /employees`, `GET /employees/:id`, `GET /departments`, `GET /departments/:id` (constante `READ_ROLES`) et aux routes documents (`DOCUMENT_ROLES`). Les 4 autres rôles restent pour T2.4.3.
- Volumes après 2.3 : 4 rôles, 16 permissions, 45 liaisons rôle-permission.
- Rôle principal (I6), backend et frontend : SUPER_ADMIN > ACCOUNTANT > DEPARTMENT_MANAGER > EMPLOYEE.

**API (T2.3.3, T2.3.4) :**
- Scope de lecture : SUPER_ADMIN et ACCOUNTANT voient tout ; un DEPARTMENT_MANAGER voit uniquement son département, appliqué dans la requête Prisma, y compris quand un filtre `departmentId` est fourni. Une facture hors scope renvoie 404.
- Référence `TRX-{AAAA}-{NNNNN}` : 5 essais au total ; au-delà, 409 « Impossible d'attribuer une référence de transaction. Réessayez. ».
- Une transaction hors `PENDING` renvoie 409 « Cette action n'est pas possible dans l'état actuel. » (design §11). Un statut cible autre que `VALIDATED` ou `REJECTED` renvoie 400 générique.
- Une transition de facture interdite, y compris vers le même statut, renvoie 400 « Ce changement de statut n'est pas autorisé pour cette facture. » (18 transitions interdites, chacune testée). Un changement concurrent sur la même facture renvoie 409.
- Un département inexistant à la création renvoie 400 « Département inexistant. », comme pour les employés.
- La réponse d'une facture expose `allowedTransitions` (vide sans `invoices:status`) : l'écran ne propose que ces statuts, le backend reste seul juge.
- Filtres de période (`from`/`to`, `dueFrom`/`dueTo`) : dates `AAAA-MM-JJ`, bornes incluses, en UTC.
- Audit : `transaction.create`, `transaction.status_change`, `invoice.status_change`, dans la transaction de l'action. Champs en liste blanche : référence, type, montant (chaîne), devise, statut, département (Transaction) ; numéro, statut, département (Invoice). Les lectures ne sont pas journalisées.

**Interface (T2.3.5 à T2.3.8) :**
- `MoneyAmount` formate la chaîne reçue sans conversion en nombre flottant (partie entière en `BigInt`). Les décimales ne sont affichées que si elles sont non nulles, comme le format `fr-FR` du GNF.
- Le formulaire de transaction accepte la saisie française (« 1 500 000,50 ») et la normalise en chaîne décimale avant l'envoi.
- Sidebar : entrée « Finance » (icône `Wallet`) non cliquable, avec les sous-liens accessibles (Transactions, Factures). Sur mobile, l'icône mène au premier sous-lien accessible.
- Dashboard ACCOUNTANT : recettes et dépenses **validées** du mois civil courant (UTC), 5 transactions les plus récentes, factures `SENT` et `OVERDUE` (nombre total et 5 premières par échéance). Le seed ne contient aucune transaction du mois de novembre 2026 : les indicateurs du mois valent 0 sur la base de dev tant qu'aucune transaction n'est validée. Le dashboard consolidé du SUPER_ADMIN reste pour T2.4.11.

---

## 2.4 — RBAC complet

### M15 — IT_TECHNICIAN (Q12)
- Lecture seule sur les employés et les départements, plus ses notifications (2.5).
- **Aucun accès** aux documents, à la finance, à l'administration ni à l'audit.
- Dashboard simple : « État des services » (M20).
- Le profil (`/profile`) relève de l'étape 3.2.

### M16 — Changement de statut d'un employé (Q13, tâche T2.4.R1)
- Endpoint `PATCH /employees/:id/status`, permission `employees:status`.
- Rôles : SUPER_ADMIN et HR_MANAGER sur tous les départements ; DEPARTMENT_MANAGER dans son département uniquement (scope I6).
- Passer à `SUSPENDED` ou `TERMINATED` fait, **dans une seule transaction** :
  - mise à jour du statut de l'employé ;
  - compte `User` lié en `SUSPENDED` ;
  - révocation de toutes ses sessions actives ;
  - entrée d'audit `employee.status_change`.
- Le bouton « Suspendre » de la fiche employé est activé, avec une modale de confirmation.
- **Réactivation** (`→ ACTIVE`) : seule la fiche employé redevient active. Le compte reste suspendu et se réactive explicitement via `/access/users`. **(dérivé — validé le 2026-11-05 : défaut sûr)**
- Interdit de changer son propre statut (403). **(dérivé — validé le 2026-11-05)**

### M17 — Gestion des comptes `/access/users` (Q14) et anti-escalade
- MVP 2 ne prévoit **pas de création de compte** via l'interface. Seules trois opérations existent, ouvertes à l'IT_ADMINISTRATOR et au SUPER_ADMIN (PRD §4.7) :
  - attribution et retrait de rôle ;
  - suspension et réactivation de compte ;
  - **déverrouillage manuel** (tâche T2.4.R2 : `LOCKED → ACTIVE`, `failedLoginCount = 0`, entrée d'audit `user.unlock`).
- **Garde-fous d'anti-escalade (dérivé — validé le 2026-11-05 ; sans eux, l'IT_ADMINISTRATOR pourrait s'octroyer SUPER_ADMIN) :**
  - seul un SUPER_ADMIN attribue ou retire le rôle SUPER_ADMIN ;
  - personne ne modifie ses propres rôles, ni ne suspend ou déverrouille son propre compte ;
  - un IT_ADMINISTRATOR ne peut suspendre, réactiver, déverrouiller ni modifier les rôles d'un compte SUPER_ADMIN ;
  - **le dernier SUPER_ADMIN actif ne peut être ni suspendu ni rétrogradé par un tiers** (ajout validé le 2026-11-05). Concrètement :
    - suspension, réactivation ou retrait du rôle SUPER_ADMIN par un autre compte : 403 ;
    - le verrouillage automatique d'I14 s'applique aussi au dernier SUPER_ADMIN actif : au cinquième échec consécutif, son compte passe à `LOCKED` ;
    - chaque verrouillage de ce compte écrit un `SecurityEvent account_locked` de sévérité `HIGH` (à partir de 2.6) et envoie une notification `WARNING` à tous les IT_ADMINISTRATOR actifs (à partir de 2.5). Le rate limiting par IP (5 / 15 min) et les `AuthEvent LOGIN_FAILED` restent applicables ;
    - la récupération se fait par expiration du verrou après 15 minutes selon I14, ou par le seed de développement qui réinitialise le compte. Le déverrouillage manuel via `/access/users` ne s'applique pas à ce compte ; aucun script CLI de déverrouillage n'est prévu ;
  - les rôles d'un compte `ACTIVE_DIRECTORY` ne sont pas modifiables via l'interface, car ils sont resynchronisés depuis les groupes AD à chaque connexion (`05` §5.2, étape 8). Une telle tentative renvoie 409.

### M18 — Matrice rôle ↔ permission (Q15 + clarification)
- Modifiable **uniquement par le SUPER_ADMIN** (permission `roles:write`). L'IT_ADMINISTRATOR la consulte en lecture seule (`roles:read`).
- **Garde-fous :**
  - le rôle SUPER_ADMIN détient toujours toutes les permissions et n'est pas modifiable ;
  - un utilisateur ne peut pas retirer une permission d'un rôle qu'il détient lui-même.
- Toute modification :
  - envoie une notification `ROLE_CHANGED` à **chaque utilisateur titulaire du rôle**, dans la même transaction (à partir de 2.5 ; en 2.4, l'emplacement est prévu sans notification) ;
  - écrit une entrée d'audit `role.permissions_update`.

### M31 — Mise en œuvre de l'étape 2.4 (2026-11-06)
**Rôles et permissions (T2.4.1) :**
- L'étape crée les 4 rôles IT_ADMINISTRATOR, IT_TECHNICIAN, HR_MANAGER et AUDITOR. Le 5e rôle de `06` §2.4, ACCOUNTANT, existe depuis 2.3 (M6, M30) : 8 rôles au total.
- **23 permissions, pas 30 :** M24 répartit le catalogue par étape. Les 7 permissions restantes (`notifications:*`, `audit:read`, `security_events:read`, `documents:history`, `ad_mappings:*`) arrivent avec leurs routes en 2.5, 2.6 et 2.7. Les créer maintenant laisserait des permissions orphelines, sans route.
- Matrice : celle de design §2, limitée aux 23 permissions existantes ; 85 liaisons rôle-permission. Le SUPER_ADMIN détient toujours l'intégralité du catalogue (calculée, M18).
- ACCOUNTANT est inchangé par rapport à 2.3 (11 permissions, conformes à la ligne ACC de design §2) : aucun doublon, aucune permission orpheline (test du seed).
- IT_TECHNICIAN : 3 permissions (dashboard, employés, départements en lecture, M15). AUDITOR : lecture employés et départements, plus les permissions documents de la matrice de design §2 ; aucune permission d'audit avant 2.6. Les permissions en trop sont contrôlées par un test dédié.
- Mots de passe de démonstration : `GF_ItAdmin2026!`, `GF_ItTech2026!`, `GF_Hr2026!`, `GF_Audit2026!`, surchargeables par `SEED_PASSWORD_<ROLE>` (ajoutés à `.env.example`).

**Comptes (T2.4.2, M5) :** `t.balde` SA, `m.keita` ITA, `f.camara` HR, `a.barry` DM (département AC), `ibrahima.sow` ACC, `s.toure` AUD, `f.kaba` ITT ; l'ancien rôle est retiré. Le créateur des factures et transactions du seed devient `t.balde` pour une base neuve.

**Tests MVP 1 mis à jour (T2.4.4, Q3) :**
- `test/helpers.ts` : `CREDENTIALS` = SA `t.balde`, DM `a.barry`, plus `itAdmin`, `itTech`, `hr`, `accountant`, `auditor`.
- `rbac`, `modules`, `documents`, `finance` : le DEPARTMENT_MANAGER et son scope passent du département RH au département AC ; `modules` : effectif RH 6 (l'employé créé par le DM est désormais en AC).
- `auth`, `lockout` : identifiants littéraux remplacés par `CREDENTIALS`.
- `documents` : l'EMPLOYEE de la Direction devient `m.sylla` (`t.balde` est SUPER_ADMIN) ; la sélection d'un employé par département ne retient que des comptes EMPLOYEE.
- `seed` : matrice exacte des 8 rôles, personas de M5, délai explicite de 90 s pour le test qui enchaîne deux seeds.
- `employees.service.spec` : le service reçoit `AuditService`. `employee-number` et `validation` n'ont pas changé.

**Routes (T2.4.3) :** `@Roles` par constantes (`ALL_ROLES`, `READ_ROLES`, `EMPLOYEE_WRITE_ROLES`, `DOCUMENT_ROLES`, `DOCUMENT_VALIDATE_ROLES`, `FINANCE_*`, `ACCESS_ROLES`). HR_MANAGER écrit sur les employés de tous les départements, sans scope. Rôle principal (I6) : SA > ITA > HR > ACC > DM > AUD > ITT > EMP, identique au backend et au frontend.

**Statut d'un employé (T2.4.5, M16) :**
- Même statut : 409. Les autres changements sont permis, y compris depuis `TERMINATED` ; l'interface ne propose « Réactiver » que pour un employé non actif.
- **(dérivé — à valider)** Suspendre l'employé lié à un compte SUPER_ADMIN applique les garde-fous de M17 (non-SA → 403, dernier SA actif → 403). Sans cela, un HR_MANAGER suspendrait le compte de la Direction par sa fiche employé.
- Audit `employee.status_change` : statut de l'employé, statut du compte et nombre de sessions révoquées. Un employé sans compte ne change que de statut.

**Comptes (T2.4.8, T2.4.9, M17) :**
- **(dérivé — à valider)** « Un IT_ADMINISTRATOR n'agit pas sur un SUPER_ADMIN » est généralisé à **tout compte non SUPER_ADMIN** : la matrice étant modifiable, un autre rôle pourrait recevoir `users:*`.
- Dernier SA actif : vérifié dans la transaction, en isolation SERIALIZABLE (un conflit renvoie 409). Comme l'auteur d'une action est forcément un compte actif et qu'agir sur soi-même est interdit, cette règle n'est pas atteignable seule par l'API tant que les règles précédentes s'appliquent ; elle reste en défense en profondeur, couverte par un test unitaire et par un test de suspensions croisées simultanées de deux SA (un seul aboutit).
- Transitions de statut d'un compte : `ACTIVE` ou `LOCKED` → `SUSPENDED` (sessions révoquées) ; `SUSPENDED` → `ACTIVE` (compteur d'échecs à 0) ; `LOCKED` → `ACTIVE` uniquement par `/unlock` (sinon 409) ; même statut : 409.
- **(dérivé — à valider)** Un compte garde au moins un rôle : `roleIds` vide → 400. Rôle inexistant → 400 « Rôle inexistant. ». Aucun changement → 200 sans audit.
- Audits : `role.assign` et `role.remove` (un par rôle), `user.suspend`, `user.reactivate`, `user.unlock`, `role.permissions_update`.
- La liste des comptes expose des `capabilities` calculées avec les mêmes règles que le service : l'interface ne rend pas les actions interdites (design §6.3) ; le serveur reste seul juge.
- Points d'appel prévus : notifications `ROLE_CHANGED` (2.5) ; au verrouillage d'un compte, alerte `WARNING` aux ITA et `SecurityEvent account_locked` (2.5, 2.6). Ils sont marqués dans le code, sans effet en 2.4.
- Verrouillage automatique (I14) inchangé : il s'applique à tous les comptes, y compris le dernier SA actif (cadre labo : le brute force reste démontrable).

**Interface et dashboards (T2.4.6, T2.4.10, T2.4.11) :**
- Recharts 2.15.4 installé dans le frontend (TRD : graphiques), pour la répartition par département du dashboard HR.
- `ConfirmDialog` accepte un contenu complémentaire (option « Sortie définitive »). Nouveau composant `ui/checkbox.tsx`, libellé toujours visible.
- La création d'employé est affichée selon la permission `employees:write` (SA, HR, DM), et non plus selon les rôles SA et DM.
- Dashboards : SA (effectif, état des services, comptes récents), ITA (comptes récents, état des services), ITT (état des services), HR (effectif, répartition, 5 dernières embauches), AUD (« Mes informations »). « Comptes récents » : les 5 derniers créés et les 5 derniers suspendus.
- EMPLOYEE et AUDITOR ont les mêmes droits sur les endpoints jusqu'à 2.6 ; leurs dashboards les distinguent.

---

## 2.5 — Notifications

### M19 — Déclencheurs (Q16)

| Événement | Type | Destinataires |
|---|---|---|
| Connexion depuis un **nouvel appareil** : couple (user-agent, IP) jamais vu dans les sessions passées de ce compte | `SECURITY` | l'utilisateur |
| Partage d'un document | `DOCUMENT_SHARED` | le bénéficiaire |
| Attribution ou retrait de rôle d'un utilisateur | `ROLE_CHANGED` | l'utilisateur concerné |
| Modification de la matrice d'un rôle | `ROLE_CHANGED` | tous les titulaires du rôle |
| **Alerte administrative** : verrouillage d'un compte (émis par le système) | `WARNING` | tous les comptes IT_ADMINISTRATOR actifs |
| Création d'un employé avec un responsable désigné (AppFlow §6) | `INFO` | le compte du responsable, s'il en a un |

- La toute première connexion d'un compte (aucune session antérieure) ne génère pas d'alerte « nouvel appareil ». **(dérivé — validé le 2026-11-05)**
- Le compteur du badge de la topbar est rechargé à chaque navigation et après chaque action sur les notifications, sans temps réel. **(dérivé — validé le 2026-11-05)**

### M32 — Mise en œuvre de l'étape 2.5 (2026-11-06)
**Destinataires de l'alerte administrative (question du 2026-11-06) :** l'utilisateur confirme M19 : le `WARNING` de verrouillage va aux seuls IT_ADMINISTRATOR actifs, pas aux IT_TECHNICIAN.

**Permissions (T2.5.1) :** `notifications:read` et `notifications:update` pour les 8 rôles : 25 permissions, 101 liaisons rôle-permission.

**API (T2.5.2) :**
- Liste paginée (25 par défaut, 100 au plus), filtre `status=read|unread`, tri `createdAt desc` ; compteur ; marquer comme lue (idempotent : la date de première lecture est conservée) ; tout marquer comme lu (`{ updated }`).
- Toute requête est filtrée sur le destinataire dans la requête Prisma. La notification d'un autre utilisateur, y compris pour le SUPER_ADMIN, renvoie le même 404 qu'un identifiant inexistant : aucune fuite d'existence.
- La spec ne prévoit ni suppression ni « marquer comme non lue » : ces opérations n'existent pas (une route `DELETE` renvoie 404).

**Déclencheurs (T2.5.3), tous écrits dans la transaction de l'action :**
- Nouvel appareil : alerte `SECURITY` si le couple (user-agent, IP) est absent des sessions antérieures et qu'au moins une session antérieure existe. La connexion locale passe en transaction interactive pour inclure la notification.
- Partage de document : `DOCUMENT_SHARED` au bénéficiaire (titre du document, auteur, niveau d'accès). Un partage refusé (409) n'écrit aucune notification.
- Rôles d'un compte : `ROLE_CHANGED` à l'utilisateur concerné (rôles attribués et retirés, libellés français) ; aucune notification si rien ne change.
- Matrice d'un rôle : `ROLE_CHANGED` à chaque titulaire du rôle.
- Verrouillage d'un compte : `WARNING` à chaque IT_ADMINISTRATOR actif, hors compte verrouillé ; titre « Compte Super Admin verrouillé » pour un SUPER_ADMIN (M17). Le `SecurityEvent` reste pour 2.6.
- Création d'un employé avec responsable désigné : `INFO` au compte du responsable, s'il en a un (AppFlow §6).
- La validation ou le rejet d'un document n'est pas un déclencheur de M19 : aucune notification.

**Interface (T2.5.4) :**
- Cloche de la topbar : lien vers `/notifications`, compteur réel (valeur initiale chargée par le layout, puis rechargée à chaque navigation et après chaque action via un événement navigateur), « 99+ » au-delà de 99.
- `/notifications` : filtres Toutes / Non lues / Lues, icône Lucide par type (design §7.3), « Marquer comme lu », « Tout marquer comme lu », pagination par 20, états squelette, vide, erreur et 403.
- Dashboard EMPLOYEE : carte « Mes notifications » (5 dernières).
- Aucune entrée de sidebar : la spec ne prévoit que la cloche.

---

## 2.6 — Administration et audit

### M20 — Événements de sécurité, logs, état des services (Q17)
**`SecurityEvent` écrits par l'application :**

| eventType | Sévérité | Déclenchement |
|---|---|---|
| `account_locked` | MEDIUM (HIGH pour le dernier SUPER_ADMIN actif, M17) | verrouillage d'un compte (I14) |
| `repeated_forbidden` | MEDIUM | au moins 5 refus 403 pour un même compte en 5 minutes glissantes ; un seul événement par fenêtre ; compteur en mémoire du processus **(dérivé — validé le 2026-11-05)** |
| `ad_unreachable` | HIGH | LDAP injoignable (2.7) |

**Logs :**
- Les logs Pino avec `requestId` (TRD §2, §11) sont **reportés à l'étape 3.3**.

**Dette technique pour l'étape 3.3 (ajout validé le 2026-11-05) :**
- Le compteur `repeated_forbidden` est **en mémoire du processus** : remis à zéro à chaque redémarrage, non partagé entre instances.
- À traiter en 3.3, avec le durcissement : stockage partagé ou dérivé des logs structurés.
- Même nature que le rate limiting en mémoire du MVP 1.
- **Bibliothèque LDAP (ajout du 2026-11-06, demande de l'utilisateur) :** évaluer la migration de `ldapjs` vers `ldapts` avant la fin du projet. `ldapjs` est abandonné par ses mainteneurs, bien que fonctionnel et sans vulnérabilité connue (essai T2.7.0, M26). La migration ne touche que `ad-auth/ldap-client.ts`, derrière l'interface `LdapClientFactory` ; les tests `npm run test:ad` servent de non-régression.

**« État des services »** (dashboards IT_ADMINISTRATOR, IT_TECHNICIAN, SUPER_ADMIN) :
- **base de données** : requête Prisma triviale, sans SQL brut ;
- **LDAP** : bind du compte de service, avec un timeout de 3 s. Le résultat est mis en cache 30 s **(dérivé — validé le 2026-11-05)**.
- Avant 2.7, le LDAP s'affiche « Non configuré ».

### M21 — L'IT_ADMINISTRATOR n'a pas accès à `/admin/audit` (clarification)
- PRD §4.9 et AppFlow §3.10, plus précis que le persona PRD §3, l'emportent : `/admin/audit` est réservé à l'AUDITOR (lecture) et au SUPER_ADMIN.
- L'IT_ADMINISTRATOR voit les événements de sécurité récents **sur son dashboard uniquement** (AppFlow §5).

### M33 — Mise en œuvre de l'étape 2.6 (2026-11-06)
**Permissions (T2.6.1) :** `audit:read`, `security_events:read` et `documents:history` pour le SUPER_ADMIN et l'AUDITOR : 28 permissions, 107 liaisons rôle-permission.

**Audit (T2.6.2) :**
- `employee.create` (toutes les valeurs de la fiche) et `employee.update` (champs modifiés seulement, avant et après) sont écrits dans la transaction de l'action. Liste blanche Employee étendue aux champs de la fiche ; aucun secret.
- R26.1 est couverte sauf `ad_mapping.*` (étape 2.7).

**Événements de sécurité (T2.6.3) :**
- `account_locked` est désormais aussi un `SecurityEvent` (jusqu'ici, seul l'`AuthEvent ACCOUNT_LOCKED` existait). Il est écrit dans la transaction du verrouillage, avec l'alerte `WARNING` aux ITA : `HIGH` pour le dernier SUPER_ADMIN actif, `MEDIUM` sinon, y compris pour un SUPER_ADMIN quand un autre SA reste actif (M20 à la lettre).
- `repeated_forbidden` : filtre global (`APP_FILTER`) sur `ForbiddenException`, `MEDIUM`, source `rbac`. Le corps du 403 renvoyé est inchangé (corps natif de Nest). La dette du compteur en mémoire est déjà consignée (M20, ligne 3.3 de `PROGRESS.md`).
- `ad_unreachable` : type prévu dans `SECURITY_EVENT_TYPES`, écrit à l'étape 2.7.

**Endpoints (T2.6.4) :**
- `/audit/logs`, `/audit/security-events`, `/audit/auth-events` : GET uniquement, SA et AUD ; l'ITA reçoit 403 (M21).
- **(dérivé — à valider)** Filtres ajoutés à ceux de design §8.3 : `actor` et `user` (recherche partielle sur l'identifiant de connexion), car l'AUDITOR n'a pas `users:read` pour choisir un `actorId` ; `action` terminée par un point filtre une famille (`document.`) ; `resourceId`.
- **(dérivé — à valider)** `/documents/:id/history` applique la visibilité de M9 : le SUPER_ADMIN voit tout, l'AUDITOR seulement les documents qu'il peut consulter (sinon 404, sans fuite). Les consultations de documents confidentiels restent visibles dans `/admin/audit`.

**Interface (T2.6.5, T2.6.6) :**
- `/admin/audit` : onglets Journal d'activité, Événements de sécurité (si `security_events:read`) et Authentifications, filtres (période, utilisateur, action ou type, sévérité), pagination par 25, panneau de détail avant/après. `/admin` redirige vers `/admin/audit`. Entrée « Audit » (`ScrollText`) pour `audit:read`.
- `ui/tabs.tsx` : navigation au clavier (flèches, Début, Fin) ; l'onglet actif est souligné par un trait au token `link`.
- Section « Historique de consultation » sur `/documents/[id]` pour `documents:history`.
- Dashboards : SA « Activité récente » ; AUD « Derniers événements d'audit » et « Alertes de sécurité » (HIGH et CRITICAL), qui remplacent « Mes informations » ; ITA « Événements de sécurité récents », en plus de « État des services » (base de données, « Non configuré » pour le LDAP jusqu'en 2.7, depuis 2.4).
- `/admin/settings` n'est pas livré : il relève de l'étape 3.2 (notes de `tasks.md`).

**Tests :**
- `test/audit.int-spec.ts` : matrice des 8 rôles, filtres, immutabilité (inventaire des routes d'écriture appelées sur un `AuditLog` existant, plus des tentatives directes PATCH, PUT, DELETE et POST → 404 ; contenu inchangé), `account_locked`, `repeated_forbidden` en horloge simulée, critère 2.6, et absence de secrets dans les logs (logger capturé), les journaux, les événements et les notifications lors des connexions.
- `test/roles-matrix.int-spec.ts` : sonde `GET /audit/logs` ajoutée ; les 8 rôles ont désormais 8 comportements distincts sur les endpoints.

---

## 2.7 — Active Directory (LDAP de test)

### M22 — Écran `/access/ad-mappings` (Q18) — écart justifié par rapport à AppFlow
- AppFlow §2 ne prévoit pas cet écran, mais `06` §2.7 exige une « interface d'administration simple » de `AdGroupRoleMapping`.
- Il est ajouté sous `/access` :
  - réservé à l'IT_ADMINISTRATOR et au SUPER_ADMIN ;
  - permissions `ad_mappings:read` et `ad_mappings:write` ;
  - visible dans le sous-menu Accès.
- Garde-fou : seul un SUPER_ADMIN crée ou supprime un mapping vers le rôle SUPER_ADMIN (cohérent avec M17). **(dérivé — validé le 2026-11-05)**

### M23 — Mécanisme AD contre un LDAP de test (Q19 + clarification)
**Configuration :**
- Tout ce qui dépend de l'AD est configurable par variables d'environnement (voir design §8).
- Bibliothèque **`ldapjs`** (TRD §8), en **LDAPS uniquement**, avec un timeout de 3 s.
- Le certificat du LDAP de test est fourni par `AD_CA_CERT_PATH`. La vérification TLS n'est **jamais** désactivée.

**LDAP de test (Docker Compose, profil `ad-test`) :**
- Image `osixia/openldap`, port 636 lié à `127.0.0.1` uniquement.
- Suffixe `dc=gnpaytrust,dc=local`.
- OU : Direction, RH, Comptabilite, Informatique, Commercial, Audit, ServiceAccounts.
- Compte de service `svc-ldapreader`.
- Utilisateurs et groupes **de test uniquement**.

**Rattachement provisoire :**
- Première connexion : `mail = professionalEmail`, puis enregistrement de `adObjectGuid` et `adSid` dans `EmployeeIdentity`.
- Connexions suivantes : par GUID.
- OpenLDAP n'a ni `objectGUID` ni `objectSid` : en test, l'attribut GUID est `entryUUID` et l'attribut SID est vide.

**Défauts sûrs (refus avec le message générique, sauf panne) :**

| Situation | Événement |
|---|---|
| Aucune fiche Employee ne correspond | `AD_NO_EMPLOYEE_MATCH` |
| Aucun groupe mappé | `AD_NO_ROLE_MAPPING` |
| **L'employé a déjà un compte LOCAL**, ou l'identifiant ou l'email est déjà pris : refus, **jamais de fusion** | `AD_LOCAL_ACCOUNT_CONFLICT` |
| AD injoignable : refus, **jamais de repli local**, message distinct d'AppFlow §3.2 | `AD_UNREACHABLE` + `SecurityEvent ad_unreachable` |

**Un `AuthEvent` distinct par étape :**
- échec du bind du compte de service : `AD_SERVICE_BIND_FAILED` ;
- utilisateur introuvable lors de la recherche : `AD_USER_NOT_FOUND` ;
- échec du bind de l'utilisateur : `AD_BIND_FAILED` ;
- succès : `LOGIN_SUCCESS`, avec `authenticationMethod = ACTIVE_DIRECTORY`.

**Données et tests :**
- Les fiches Employee rattachées aux comptes AD de test n'ont **aucun compte local**. Elles sont créées par les tests AD (base de test) ou par le script facultatif `seed:ad-test` (hors des 40 employés de `05` §7).
- Le rate limiting est de 5 tentatives / 15 min / IP sur `/auth/login-ad` (TRD §6).
- Le verrouillage par compteur ne s'applique pas aux comptes AD : la politique de verrouillage relève de l'AD.
- Chaque point à revoir est marqué `TODO(AD-REVISION)` dans le code prévu.

---

### M34 — Mise en œuvre de l'étape 2.7 (2026-11-06)
**Domaine :** le LDAP de test reprend le domaine réel `gnpaytrust.local` (`dc=gnpaytrust,dc=local`), à la demande de l'utilisateur. Les occurrences de `guineafinance.local` des specs sont remplacées (DECISIONS M23, design §9.1, requirements R30.1). Le nom commercial « GUINEA FINANCE » (interface, PDF du seed) et le domaine de messagerie `@guineasf.com` ne sont pas concernés.

**Migration (T2.7.1) :** `ad_auth_event_types` ajoute 5 valeurs à `AuthEventType` (PostgreSQL 16 : une seule migration).

**LDAP de test (T2.7.2) :**
- Service `ldap-test` (profil `ad-test`, `osixia/openldap:1.5.0`, LDAPS imposé, `127.0.0.1`). Les LDIF sont montés dans le répertoire de bootstrap : ils ne sont appliqués qu'au premier démarrage, ce qui permet d'arrêter puis de relancer le conteneur (le montage via `LDAP_SEED_INTERNAL_LDIF_PATH` empêchait le redémarrage).
- **Écart :** podman rootless ne peut pas lier un port inférieur à 1024 sur ce poste (`ip_unprivileged_port_start = 1024`) ; le port hôte vient de `LDAP_TEST_PORT` (636 par défaut, conforme à la spec ; 1636 utilisé ici). Aucun réglage système n'a été modifié.
- Mots de passe de l'annuaire stockés en `{SSHA}` dans les LDIF ; valeurs en clair de test documentées dans `infra/ldap-test/README.md`, comme les mots de passe de démonstration du seed (I11). Mot de passe admin du conteneur : `LDAP_TEST_ADMIN_PASSWORD`.

**Backend (T2.7.4 à T2.7.8) :**
- Variables `AD_*` validées ; une variable manquante, une URL autre que `ldaps://` ou une CA illisible rendent l'AD indisponible (503, `AD_UNREACHABLE`, `SecurityEvent ad_unreachable` HIGH). L'AD est désactivé tant que `AD_LDAP_URL` est vide (valeur de `.env.example`).
- `ldapjs` étant un module CommonJS, seul son export par défaut est disponible sous Node natif : un import nommé faisait planter le backend compilé, sans que Vitest le révèle. `SearchEntry.objectName` est un objet DN en v3 : sa forme texte (`pojo.objectName`) est utilisée. Ces deux défauts ont été trouvés par les tests contre le LDAP Docker.
- `AuthService.openSession` est partagé par les flux local et AD : session, `LOGIN_SUCCESS` (méthode `ACTIVE_DIRECTORY`), alerte « nouvel appareil ».
- Un compte AD existant suspendu ou verrouillé est refusé (401, `LOGIN_FAILED`).
- **(dérivé — à valider)** L'identifiant saisi est limité à `[A-Za-z0-9._-]` (400 sinon), en plus de l'échappement RFC 4515 du filtre.
- Throttler nommé `login-ad` (5 / 15 min / IP), indépendant de celui de `/auth/login`.
- « État des services » : LDAP Disponible, Indisponible ou Non configuré (bind du compte de service, 3 s, cache 30 s, M20).
- Audit `ad_mapping.create` et `ad_mapping.delete` ; un mapping en double renvoie 409.
- Les rôles d'un compte AD restent non modifiables via `/access/users` (409, règle M17 de 2.4), et l'interface ne propose pas l'action (`canAssignRoles` faux) ; test ajouté.

**Seed :** 30 permissions (catalogue complet de M24), 111 liaisons rôle-permission. `npm run seed:ad-test` crée 5 fiches de test sans compte local (`GF-2026-901` à `905`, hors des 40 employés de `05` §7) et 4 mappings.

**Interface (T2.7.9) :** `/login/ad` reprend le formulaire local (point d'entrée `/auth/login-ad`, message distinct d'AppFlow §3.2 sur 503). `/access/ad-mappings` : sous-lien « Mappings AD » du menu Accès (`ad_mappings:read`) ; l'option SUPER_ADMIN et la suppression d'un mapping SUPER_ADMIN ne sont proposées qu'au SUPER_ADMIN.

**Tests :** sans Docker, `ad-auth.spec.ts` (échappement, GUID, SID, configuration), `ad-auth.int-spec.ts` (annuaire simulé : chaque branche et son `AuthEvent`, défauts sûrs, aucun repli local, `ad_unreachable`, mot de passe jamais stocké, 409 sur les rôles d'un compte AD, rate limiting) et `ad-mappings.int-spec.ts` ; avec Docker, `npm run test:ad` (`test/ldap.ad-spec.ts`).

## Transverse

### M24 — Catalogue de permissions (30, dans la fourchette 30–40 de `05` §7)

| Étape | Permissions ajoutées | Total |
|---|---|---|
| MVP 1 | `dashboard:read`, `employees:read`, `employees:write`, `employees:delete`*, `departments:read`, `departments:write`* | 6 |
| 2.2 | `documents:read`, `documents:write`, `documents:validate`, `documents:share`, `documents:delete` | 11 |
| 2.3 | `transactions:read`, `transactions:write`, `transactions:validate`, `invoices:read`, `invoices:status` | 16 |
| 2.4 | `employees:status`, `roles:read`, `roles:write`, `users:read`, `users:assign_role`, `users:suspend`, `users:unlock` | 23 |
| 2.5 | `notifications:read`, `notifications:update` | 25 |
| 2.6 | `audit:read`, `security_events:read`, `documents:history` | 28 |
| 2.7 | `ad_mappings:read`, `ad_mappings:write` | 30 |

\* Ces permissions existent mais aucune route ne les utilise en MVP 2 : AppFlow ne prévoit ni suppression d'employé ni écran d'édition de département.

- Les routes de notifications portent `@Roles` (les 8 rôles) et `@Permission`. `@AuthenticatedOnly()` reste **réservé** à `/auth/me` et `/auth/logout` (I15).
- `documents:history` (historique de consultation, « visible selon rôle », AppFlow §3.6) est attribuée à l'AUDITOR et au SUPER_ADMIN. **(dérivé — validé le 2026-11-05)**

### M25 — Aucun placeholder visible
- Dès 2.2, les cartes de dashboard « disponible prochainement » du MVP 1 sont retirées.
- Une carte n'est rendue que si son module fournit des données réelles :
  - documents : 2.2 ;
  - finance : 2.3 ;
  - comptes : 2.4 ;
  - notifications : 2.5 ;
  - activité et événements de sécurité : 2.6 ;
  - LDAP : 2.7.

### M26 — Risque : `ldapjs` n'est plus maintenu (décision en T2.7.0, sur preuve)
- `ldapjs`, imposé par TRD §8, est archivé par ses mainteneurs depuis 2024.
- La spec le conserve conformément au TRD, derrière une interface `LdapClient` isolée pour permettre un remplacement (ex. `ldapts`) sans toucher au service.
- **À décider avant 2.7 (tâche T2.7.0), sur preuve :** un essai de compatibilité de `ldapjs` avec **Node 24 et l'ESM** du backend (import ESM, bind LDAPS et recherche contre le LDAP de test, timeout, absence d'avertissement bloquant) est exécuté. Son résultat est documenté ici avant de trancher entre garder `ldapjs` et amender le TRD (ajout validé le 2026-11-05).

**Résultat de l'essai T2.7.0 (2026-11-06, Node 24.21.0, `ldapjs` 3.0.7, `@types/ldapjs` 3.0.6), dans un projet isolé, contre le LDAP de test Docker :**

| Vérification | Résultat |
|---|---|
| Import ESM (`import ldap from 'ldapjs'`, export CommonJS par défaut) | OK |
| Typage avec la configuration du backend (`module`/`moduleResolution` `nodenext`, `esModuleInterop`), y compris avec `skipLibCheck: false` | OK, 0 erreur |
| Bind LDAPS du compte de service, CA du conteneur | OK |
| Recherche : `mail`, `memberOf` (2 groupes), `entryUUID` | OK |
| Bind utilisateur : bon mot de passe accepté, mauvais refusé (`InvalidCredentialsError`) | OK |
| CA inconnue refusée (`SELF_SIGNED_CERT_IN_CHAIN`) : la vérification TLS reste active | OK |
| Délai de 3 s : handshake TLS jamais conclu → erreur à 3020 ms ; bind sans réponse → `TimeoutError` à 3027 ms | OK |
| Port fermé → `ECONNREFUSED` immédiat | OK |
| Avertissements à l'exécution (`--trace-deprecation --trace-warnings`) | aucun |
| Avertissements à l'installation | `ldapjs` et ses 9 sous-paquets `@ldapjs/*` signalés « decomissioned » par npm ; 0 vulnérabilité connue (`npm audit`) |

**Décision :** aucun défaut de fonctionnement ; seul l'abandon officiel du paquet, déjà connu, pose un risque de maintenance (aucun correctif de sécurité à venir). `ldapjs` est **conservé** conformément au TRD §8, derrière l'interface `LdapClientFactory` / `LdapConnection` (`ad-auth/ldap-client.ts`) : le reste du module n'importe jamais `ldapjs`. Alternative identifiée pour un remplacement ultérieur, sans changement du service : `ldapts` (9.2.0, maintenue, TypeScript natif). À trancher avec l'utilisateur ; marqué `TODO(AD-REVISION)`.

### M27 — Mise en œuvre de l'étape 2.1 (2026-11-05)
- **Aucune migration** à l'étape 2.1 : le schéma permet déjà le seed complet. `05-Backend-Schema.md` est inchangé.
- **Structure du seed :**
  - `prisma/seed-lib.ts` contient les écritures idempotentes communes (organisation, rôles, matrice synchronisée à l'identique, comptes) ;
  - `prisma/seed-mvp1.ts` expose `MVP1_DATA` et `seedMvp1()`, et reste exécutable seul (`npm run seed:mvp1`) ;
  - `prisma/seed.ts` étend `MVP1_DATA`, sans dupliquer ses données (`prisma/seed-data/`).
- **Fichiers (précision de M10) :** PDF et PNG générés par programme ; **JPG**, DOCX et XLSX copiés depuis des gabarits versionnés dans `prisma/seed-fixtures/`. Un encodeur JPEG écrit à la main n'apporterait rien ; les gabarits ont été produits localement (PIL, `zipfile`) et vérifiés par `file`, PIL et `pdfinfo`.
- **Variables vides :** une variable `DOCUMENTS_STORAGE_DIR` ou `SEED_PASSWORD_*` vide (ligne recopiée de `.env.example`) vaut « non définie ». Sinon, les fichiers iraient dans le répertoire courant, ou un mot de passe vide serait accepté.
- **Rôles des comptes :** chaque compte du seed reçoit **exactement** le rôle prévu ; un rôle en trop est retiré. Cela prépare les réattributions de 2.3 et 2.4.
- **Tests MVP 1 mis à jour** (volumes du seed complet) :
  - `test/modules.int-spec.ts` : responsable de Mamadou Diallo, totaux 40, pagination par 10, filtre IT (7), effectif RH (7), postes et équipe RH ;
  - `test/seed.int-spec.ts` : réécrit pour le seed complet ;
  - les autres fichiers MVP 1 n'avaient pas de valeur dépendante des volumes.
- **Lint :** le dossier `prisma/` est désormais couvert par `npm run lint` (oxlint).
- **Durée des tests :** chaque fichier de test réinitialise et reseede la base de test (environ 5,5 s par seed complet). La suite backend passe d'environ 30 s à environ 110 s. Optimisation possible plus tard (seed en lot, ou base de référence clonée), sans incidence fonctionnelle.

---

## À RÉVISER APRÈS MISE EN PLACE DE L'AD

Décisions ouvertes (Q19 reportée). Chaque point est marqué `TODO(AD-REVISION)` dans le code de 2.7 ; l'emplacement est indiqué (revue T2.7.12 du 2026-11-06 : 16 marqueurs, tous rattachés à un point ci-dessous).

1. **Rattachement AD → Employee :** provisoirement par `mail = professionalEmail` (insensible à la casse), puis par GUID. À confirmer selon l'attribut fiable du vrai annuaire (`mail`, `employeeID`, `userPrincipalName`). — `ad-auth.service.ts` (étape 4).
2. **Attributs réels :** identifiant `sAMAccountName` (test : `uid`), GUID `objectGUID`, à convertir du binaire (test : `entryUUID`), SID `objectSid`, à convertir du binaire (test : absent), groupes `memberOf`. Les conversions binaires sont écrites et testées unitairement, mais jamais exécutées contre un vrai AD. — `ad-auth.service.ts` (`toDirectoryUser`), `ldap-client.ts` (`readGuid`, `readSid`).
3. **Mapping réel des groupes AD → rôles :** les groupes de test (`cn=GFEP-*`, placés dans l'OU `Informatique`) sont fictifs. Il faut définir les groupes de production et l'éventuelle imbrication de groupes (`memberOf` ne la résout pas). — `ad-auth.service.ts` (étape 5), `ad-mappings.service.ts`, `prisma/seed-ad-test.ts`.
4. **Comptes de service :**
   - `svc-ldapreader` en lecture seule ;
   - le second compte applicatif distinct exigé par le TRD §8 n'est pas créé, car aucun usage n'existe en MVP 2 ;
   - droits minimaux et rotation des mots de passe à définir. — `ad-config.ts`.
5. **Certificat LDAPS :** en test, une CA auto-signée générée pour le conteneur (`infra/ldap-test/generate-certs.sh`). En production, la CA du DC01 ; le nom d'hôte est déjà vérifié (vérification TLS par défaut de Node, jamais désactivée). — `ad-config.ts`, `generate-certs.sh`.
6. **Employé ayant déjà un compte LOCAL :** refus en MVP 2 (`AD_LOCAL_ACCOUNT_CONFLICT`), jamais de fusion. Une procédure de migration d'un compte LOCAL vers un compte AD est à définir. — `ad-auth.service.ts`.
7. **Synchronisation des rôles :** les rôles sont écrasés depuis les groupes à chaque connexion (`assignedBy = ad-sync`). La révocation d'un compte supprimé de l'AD hors connexion n'est pas traitée. — `ad-auth.service.ts` (étape 6).
8. **Verrouillage et politique de mot de passe :** déléguée à l'AD (aucun compteur d'échecs local pour un compte AD). L'articulation avec les `AuthEvent` locaux est à définir. — `ad-auth.service.ts` (étape 3).
9. **Bibliothèque LDAP :** `ldapjs` conservé après l'essai T2.7.0 malgré son abandon ; remplacement par `ldapts` à trancher (M26). — `ldap-client.ts`.
10. **Identifiant du compte GFEP :** l'identifiant d'annuaire en minuscules (`uid`, futur `sAMAccountName`) devient `User.username` ; un identifiant ou un e-mail déjà pris par un autre compte est refusé (`AD_LOCAL_ACCOUNT_CONFLICT`). À confirmer avec les conventions de nommage de l'AD réel. — `ad-auth.service.ts` (`AD_SYNC_ASSIGNER`).
11. **E-mails des fiches de test :** les utilisateurs du LDAP de test portent des e-mails `@guineasf.com`, comme les fiches du seed. Le domaine de messagerie réel est à confirmer avec l'AD réel (`gnpaytrust.local` est le domaine AD, pas un domaine de messagerie).
