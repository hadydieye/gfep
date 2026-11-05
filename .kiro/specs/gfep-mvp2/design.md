# Design — MVP 2 (étapes 2.1 à 2.7)
## Guinea Finance Enterprise Portal (GFEP)

Références :
- exigences : `requirements.md` (R1–R34, T1–T5) ;
- décisions : `DECISIONS.md` (M1–M26) et `gfep-lot0-mvp1/DECISIONS.md` (I1–I22).

L'architecture du MVP 1 est conservée :
- Next.js, avec rewrites `/api/v1` ;
- NestJS 12 ESM ;
- Prisma 5 et PostgreSQL 16 ;
- guards globaux (I15) ;
- `configureApp()` ;
- 400 génériques (I17).

---

## 1. Conventions communes

- **Routes :** toutes sous `/api/v1`. Chaque route porte `@Roles(...)` et `@Permission(...)`. Les listes de rôles sont définies par des constantes dans `rbac/roles.ts` (`ALL_ROLES`, `DOCUMENT_ROLES`…) pour éviter les oublis.
- **Scopes métier :** scope DM, propriété, visibilité. Ils sont appliqués **dans le service**, après les guards, et inclus dans la requête Prisma (filtre `where`) plutôt que vérifiés après lecture.
- **Erreurs :**
  - 400 générique ;
  - 401 sans session ;
  - 403 pour un droit manquant ;
  - 404 pour une ressource absente ou non visible (documents) ;
  - 409 pour une transition interdite ou un conflit ;
  - 503 pour l'AD injoignable.
- **Pagination :** `page` ≥ 1 et `limit` de 1 à 100, 25 par défaut. Réponse `{ data, total, page, limit }`. Un `PaginationQueryDto` de base est réutilisé.
- **Audit :** `AuditService.record(tx, { actorId, action, resourceType, resourceId, oldValues?, newValues?, sourceIp })`.
  - Il est appelé avec le client de transaction Prisma quand l'action est transactionnelle.
  - Les champs secrets sont exclus par une liste blanche de champs par type de ressource.
- **Notifications :** `NotificationsService.notify(tx, userIds, { type, title, message })`, à partir de 2.5. Avant 2.5, les points d'appel sont prévus mais sans effet.
- **Frontend :**
  - pages serveur avec `apiGet`, pages interactives avec `apiFetch` ;
  - les quatre états via `components/states` ;
  - modale de confirmation `ConfirmDialog` (nouveau composant ui, §9) ;
  - toasts sonner ;
  - menu latéral généré depuis les permissions (`nav-items.ts`).

---

## 2. Matrice d'accès finale (après 2.7)

Le SUPER_ADMIN détient toutes les permissions (M18). Un ✓ indique que le rôle détient la permission ; « scope » signale une restriction appliquée dans le service.

| Permission | SA | ITA | ITT | HR | ACC | DM | EMP | AUD | Étape |
|---|---|---|---|---|---|---|---|---|---|
| dashboard:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | MVP1 |
| employees:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | MVP1 |
| employees:write | ✓ | | | ✓ | | ✓ scope | | | MVP1 |
| employees:status | ✓ | | | ✓ | | ✓ scope | | | 2.4 |
| employees:delete | ✓ | | | | | | | | MVP1 (inutilisée) |
| departments:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | MVP1 |
| departments:write | ✓ | | | ✓ | | | | | MVP1 (inutilisée) |
| documents:read / write / share / delete | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | 2.2 |
| documents:validate | ✓ | | | | | ✓ scope | | | 2.2 |
| documents:history | ✓ | | | | | | | ✓ | 2.6 |
| transactions:read | ✓ | | | | ✓ | ✓ scope | | | 2.3 |
| transactions:write | ✓ | | | | ✓ | | | | 2.3 |
| transactions:validate | ✓ | | | | | | | | 2.3 |
| invoices:read | ✓ | | | | ✓ | ✓ scope | | | 2.3 |
| invoices:status | ✓ | | | | ✓ | | | | 2.3 |
| roles:read | ✓ | ✓ | | | | | | | 2.4 |
| roles:write | ✓ | | | | | | | | 2.4 |
| users:read / assign_role / suspend / unlock | ✓ | ✓ | | | | | | | 2.4 |
| notifications:read / update | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 2.5 |
| audit:read, security_events:read | ✓ | | | | | | | ✓ | 2.6 |
| ad_mappings:read / write | ✓ | ✓ | | | | | | | 2.7 |

**Règles de propriété des documents** (appliquées dans le service, M11) :
- `documents:share` n'est effective que pour le propriétaire ou le SA ;
- `documents:delete` n'est effective que pour le propriétaire, le titulaire d'une permission `DELETE` ou le SA.

**Avant 2.4**, seuls les rôles qui existent reçoivent ces permissions :
- en 2.2 : SA, DM et EMP pour les documents ;
- en 2.3 : SA, ACC et DM pour la finance.

---

## 3. Étape 2.1 — Seed complet

### 3.1 Organisation des fichiers
```
apps/backend/prisma/
├── seed.ts              # seed complet (commande prisma.seed), refuse NODE_ENV=production
├── seed-mvp1.ts         # refactoré : exporte MVP1_DATA et seedMvp1(prisma, passwords)
├── seed-data/           # données fixes, déterministes
│   ├── organisation.ts  # 18 postes, 40 employés, 6 catégories
│   ├── documents.ts     # 50 documents (titre, catégorie, niveau, propriétaire, format)
│   └── finance.ts       # 30 factures, 100 transactions
├── seed-files.ts        # génère les fichiers PDF/PNG/JPG, copie les gabarits DOCX/XLSX
└── seed-fixtures/       # template.docx, template.xlsx (minimaux, versionnés)
```
- `seed.ts` appelle `seedMvp1()`, puis l'extension.
- Toutes les écritures sont des `upsert`. Leurs clés :

| Entité | Clé d'upsert |
|---|---|
| Département | `code` |
| Employé | `employeeNumber` |
| Utilisateur | `username` |
| Catégorie | `name` |
| Facture | `invoiceNumber` |
| Transaction | `reference` |
| Poste | recherche (`title`, `departmentId`) |
| Document | recherche (`title`, `ownerId`) |

- `seed-mvp1.ts` reste exécutable seul, pour compatibilité, avec la même garde de production.

### 3.2 Données

**Postes (18) :**

| Code | Postes |
|---|---|
| DG | Directeur général, Assistant(e) de direction, Chargé(e) de mission |
| RH | Responsable RH, Chargé(e) RH, Assistant(e) RH |
| CF | Responsable comptable, Comptable, Contrôleur de gestion |
| IT | Responsable informatique, Administrateur systèmes, Technicien support |
| CO | Responsable commercial, Chargé(e) de clientèle, Commercial terrain |
| AC | Responsable audit, Auditeur, Chargé(e) de conformité |

**Employés (40) :**
- répartition : DG 4, RH 6, CF 8, IT 7, CO 9, AC 6 ;
- les 6 de GF-2026-001 à 006 sont conservés ;
- personnes nommées par M5 : Thierno Baldé, Ibrahima Sow, Souleymane Touré, Fodé Kaba ; Keïta est déplacé en IT ;
- les autres portent des noms guinéens fictifs, issus d'une liste fixe ;
- numéros de GF-2026-007 à GF-2026-040 ;
- responsables hiérarchiques : le chef de département, et le Directeur général pour les chefs ;
- `Department.managerId` : DG = Baldé, RH = Camara, CF = Diallo, IT = Ibrahim Sow, CO = Bangoura, AC = Barry.

**Utilisateurs (40) :**
- `LOCAL`, un par employé, avec `EmployeeIdentity` ;
- identifiant `initiale.nom`, ou `prenom.nom` en cas de collision ;
- e-mail = `professionalEmail` ;
- rôles en 2.1 : `m.keita` SA, `f.camara` DM, tous les autres EMP.

**Mots de passe :**
- `SEED_PASSWORD_SUPER_ADMIN`, `SEED_PASSWORD_DEPARTMENT_MANAGER`, `SEED_PASSWORD_EMPLOYEE`, puis un par rôle ajouté en 2.3 et 2.4 ;
- valeurs par défaut documentées (`GF_<Rôle>2026!`) ;
- un hash argon2 par rôle et par exécution.

**Catégories (6) :** une par département (« Direction générale », « Ressources humaines », « Comptabilité », « Informatique », « Commercial », « Audit et conformité »), chacune avec son `departmentId`.

**Documents (50) :**
- environ 8 par catégorie ;
- niveaux répartis : PUBLIC 10, INTERNAL 25, CONFIDENTIAL 10, RESTRICTED 5 ;
- formats répartis : PDF 20, PNG 8, JPG 7, DOCX 8, XLSX 7 ;
- propriétaire : un employé du département de la catégorie ;
- `storagePath` UUID, `mimeType` et `fileSize` réels ;
- quelques `DocumentPermission` explicites, pour tester le partage.

**Factures (30) et transactions (100) :** répartition déterministe des statuts et des types, `createdBy` = utilisateur `m.keita`. Le `departmentId` est ajouté par l'extension de seed de l'étape 2.3.

### 3.3 Stockage
- `DOCUMENTS_STORAGE_DIR`, par défaut `apps/backend/storage/documents`, ajouté au `.gitignore` et à `.env.example`.
- Les tests utilisent un répertoire temporaire par exécution, nettoyé dans le `globalSetup`.

### 3.4 Tests (2.1)
- `test/seed.int-spec.ts` :
  - volumes de R1.4 ;
  - idempotence (deux exécutions, comptages identiques, fichiers non dupliqués) ;
  - refus en production ;
  - chaque document a un fichier lisible dont les magic bytes correspondent à son `mimeType`.
- `test/helpers.ts` : `seedOrThrow()` lance `prisma/seed.ts`.
- Mise à jour des tests MVP 1 qui dépendent des volumes : `modules.int-spec.ts` (totaux, effectifs, recherche) et `rbac.int-spec.ts`.

---

## 4. Étape 2.2 — Documents

### 4.1 Migration `document_validation_status` (M7)
```prisma
enum DocumentValidationStatus { PENDING VALIDATED REJECTED }
model Document { /* … */ validationStatus DocumentValidationStatus @default(PENDING) }
```
Aussi : `05` §3, `schema.spec.ts` (12 enums) et l'extension de seed (statuts répartis).

### 4.2 Module backend `documents/`
```
documents.module.ts  documents.controller.ts  documents.service.ts
document-access.ts      # buildVisibilityWhere(user), canValidate, canShare, canDelete
document-storage.ts     # écriture/lecture/suppression sous DOCUMENTS_STORAGE_DIR (UUID, contrôle du chemin résolu)
file-signature.ts       # détection via file-type ; liste blanche PDF/DOCX/XLSX/PNG/JPEG
dto/ list-documents-query.dto.ts  create-document.dto.ts  update-validation.dto.ts
     grant-permission.dto.ts  document-response.dto.ts
audit/ audit.module.ts  audit.service.ts   # @Global, utilisé par tous les modules suivants
```

**Visibilité (M9) :** `buildVisibilityWhere(user)` produit, pour un utilisateur non SA, la condition suivante :
```
OR [ ownerId = user.employeeId,
     confidentialityLevel = PUBLIC,
     confidentialityLevel = INTERNAL AND (category.departmentId = D OR (category.departmentId IS NULL AND owner.departmentId = D)),
     permissions.some(userId = user.id) ]
```
Elle s'applique à **toutes** les requêtes : liste, détail, téléchargement, aperçu, cartes du dashboard.

### 4.3 Endpoints

Les « rôles documents » (`DOCUMENT_ROLES`) sont SA, DM et EMP en 2.2, puis tous sauf ITT à partir de 2.4.

| Méthode | Chemin | Permission | Règle service |
|---|---|---|---|
| GET | `/documents` | documents:read | visibilité ; filtres `categoryId`, `confidentialityLevel`, `validationStatus`, `search` (titre) ; tri `createdAt desc` |
| GET | `/documents/categories` | documents:read | liste des catégories ; champ `canUpload` selon le département |
| GET | `/documents/:id` | documents:read | visibilité, sinon 404 ; audit `document.view` si sensible |
| GET | `/documents/:id/download` | documents:read | visibilité ; `attachment`, `nosniff`, nom = titre nettoyé + extension du MIME ; audit `document.download` si sensible |
| GET | `/documents/:id/preview` | documents:read | visibilité ; PDF, PNG, JPEG uniquement (sinon 404) ; `inline`, `nosniff`, `Content-Security-Policy: sandbox` |
| POST | `/documents` | documents:write | multipart (Multer, mémoire, limite 10 Mo) ; signature ; contrôle de catégorie (M11) ; `PENDING` ; écrit le fichier puis la ligne (fichier supprimé si l'insertion échoue) |
| PATCH | `/documents/:id/validation` | documents:validate | DM du département du document ou SA ; depuis `PENDING` uniquement (sinon 409) ; audit |
| GET | `/documents/:id/permissions` | documents:share | propriétaire ou SA |
| GET | `/documents/:id/share-recipients` | documents:share | propriétaire ou SA ; comptes destinataires (id, username, nom affiché) |
| POST | `/documents/:id/permissions` | documents:share | propriétaire ou SA ; `{ userId, permission }` ; unicité ; audit ; notification (2.5) |
| DELETE | `/documents/:id/permissions/:permissionId` | documents:share | propriétaire ou SA ; audit |
| DELETE | `/documents/:id` | documents:delete | propriétaire, titulaire d'une permission `DELETE`, ou SA ; transaction (ligne + permissions + audit) puis suppression du fichier |

**DTO :**
- `CreateDocumentDto` : `title` (1–200), `description?` (≤ 1000), `categoryId` (UUID), `confidentialityLevel` (enum).
- `UpdateValidationDto` : `status` (`VALIDATED` ou `REJECTED`).
- `GrantPermissionDto` : `userId` (UUID), `permission` (enum).
- `DocumentResponseDto` : `id`, `title`, `description`, `category {id, name}`, `department {id, name}`, `owner {id, firstName, lastName}`, `mimeType`, `fileSize`, `confidentialityLevel`, `validationStatus`, `createdAt`, `capabilities {canDownload, canPreview, canValidate, canShare, canDelete}`. Les capacités sont calculées côté serveur pour piloter l'interface.

Un fichier refusé (taille ou signature) donne une `BusinessRuleException` avec un message utilisateur : « Format de fichier non pris en charge » ou « Fichier trop volumineux (10 Mo maximum) ». Ce sont des messages métier conformes à `04` §7, autorisés par I17.

### 4.4 Frontend
- **`/documents`** (client) : tableau avec en-têtes collants, filtres catégorie, confidentialité, validation et recherche, badges `ConfidentialityBadge` et `ValidationBadge`, pagination, bouton « Déposer un document » (icône `Upload`).
  - État vide : icône `FileText` + « Aucun document — Déposer un document ».
- **`/documents/[id]`** (serveur et îlots client) :
  - fil d'Ariane ;
  - métadonnées ;
  - aperçu `<iframe sandbox>` pour PDF, `<img>` pour les images ;
  - bouton Télécharger ;
  - boutons Valider / Rejeter, avec modale ;
  - panneau Partage (sélecteur de compte, type de permission, liste et retrait) ;
  - bouton Supprimer (variante destructive, `ConfirmDialog`) ;
  - section Historique (2.6).
- **`/documents/upload`** (React Hook Form + Zod) :
  - champs titre, description, catégorie (seulement celles où `canUpload` est vrai), confidentialité, fichier ;
  - vérification côté client de la taille et de l'extension (confort uniquement : le serveur fait foi) ;
  - redirection vers la fiche avec un toast.
- **Dashboard :** retrait des cartes « disponible prochainement » (M25). Ajout de « Mes documents récents » (EMP) et de « Documents en attente de validation » (DM).
- **Sidebar :** entrée « Documents » (`FileText`) pour `documents:read`.

### 4.5 Tests (2.2)
`test/documents.int-spec.ts` :
- matrice de rôles sur chaque route ;
- visibilité selon les 4 niveaux, le propriétaire, le partage et le département de la catégorie ou du propriétaire ;
- 404 sur un document non visible, sur toutes les routes ;
- rejets d'upload : 10 Mo + 1 octet ; un PNG renommé `.pdf` est accepté comme PNG ; un exécutable renommé `.pdf` est refusé ;
- contrôle de catégorie ;
- validation (DM d'un autre département → 403, déjà validé → 409) ;
- partage et suppression selon la propriété ;
- audits écrits pour les documents sensibles et seulement pour eux ;
- **critère 2.2 :** deux EMPLOYEE de départements différents.

---

## 5. Étape 2.3 — Finance

### 5.1 Migration `finance_department` (M13)
```prisma
model Transaction { /* … */ departmentId String? department Department? @relation(fields: [departmentId], references: [id]) @@index([departmentId]) }
model Invoice     { /* … */ departmentId String? department Department? @relation(fields: [departmentId], references: [id]) @@index([departmentId]) }
model Department  { /* … */ transactions Transaction[] invoices Invoice[] }
```
Aussi : `05` §3, et l'extension de seed (`departmentId` réparti). Le rôle ACCOUNTANT, les permissions finance et `ibrahima.sow` = ACC sont créés par le seed.

### 5.2 Endpoints (module `finance/`)

| Méthode | Chemin | Rôles | Permission | Règle service |
|---|---|---|---|---|
| GET | `/transactions` | SA, ACC, DM | transactions:read | scope DM sur `departmentId` ; filtres `type`, `status`, `departmentId`, `from`/`to`, `search` (référence) |
| POST | `/transactions` | SA, ACC | transactions:write | `CreateTransactionDto` ; référence `TRX-AAAA-NNNNN` (transaction + nouvel essai, I16) ; `PENDING` ; `createdBy` = utilisateur ; audit |
| PATCH | `/transactions/:id/status` | SA | transactions:validate | `VALIDATED` ou `REJECTED`, depuis `PENDING` (sinon 409) ; audit |
| GET | `/invoices` | SA, ACC, DM | invoices:read | scope DM ; filtres `status`, `departmentId`, échéance, `search` (client) |
| GET | `/invoices/:id` | SA, ACC, DM | invoices:read | scope DM, sinon 404 |
| PATCH | `/invoices/:id/status` | SA, ACC | invoices:status | transitions de M14 ; **transition interdite → 400** (`BusinessRuleException`) ; audit |

**DTO :**
- `CreateTransactionDto` : `transactionType` (enum), `amount` (chaîne décimale > 0, 2 décimales maximum, ≤ 999 999 999 999,99), `description?` (≤ 500), `departmentId` (UUID, existant).
- Réponses : `amount` en chaîne, `currency`, `department {id, name, code}`, `createdBy {id, username}`.

### 5.3 Frontend
- **`/finance/transactions`** :
  - tableau avec filtres et badges (`PENDING` = attention, `VALIDATED` = succès, `REJECTED` = erreur) ;
  - montants alignés à droite, en chiffres tabulaires ;
  - actions Valider / Rejeter (SA, avec modale) ;
  - bouton « Nouvelle transaction » (ACC, SA).
- **`/finance/transactions/new`** : formulaire (type, montant, département, description).
- **`/finance/invoices`** et **`/finance/invoices/[id]`** : fiche en lecture et sélecteur de statut limité aux transitions autorisées (ACC, SA), avec modale.
- **Sidebar :** entrée « Finance » (`Wallet`), avec les sous-liens Transactions et Factures.
- **Dashboard ACC** : transactions récentes (5), factures en attente (`SENT` et `OVERDUE`), indicateurs du mois (recettes et dépenses validées). **DM** : rien de plus (AppFlow §5).

### 5.4 Tests (2.3)
`test/finance.int-spec.ts` :
- matrice SA, ACC, DM, EMP (403 pour EMP) ;
- scope DM (lignes d'un autre département ou sans département invisibles, 404 sur le détail d'une facture) ;
- création par ACC ;
- validation réservée au SA, 409 hors `PENDING` ;
- transitions de facture : chaque transition valide, et **chaque transition interdite → 400** ;
- montants en chaîne ;
- références concurrentes ;
- audits.

---

## 6. Étape 2.4 — RBAC complet

### 6.1 Seed
- Création de ITA, ITT, HR et AUD, puis des permissions `employees:status`, `roles:*` et `users:*`, puis de la matrice §2.
- Réattribution des rôles selon M5 (le rôle précédent est retiré).
- Mise à jour de `@Roles` sur toutes les routes existantes, via les constantes de `rbac/roles.ts`.

### 6.2 Endpoints

| Méthode | Chemin | Rôles | Permission | Règle service |
|---|---|---|---|---|
| PATCH | `/employees/:id/status` | SA, HR, DM | employees:status | scope DM ; pas soi-même ; transaction : employé + `User` `SUSPENDED` + sessions révoquées + audit (M16) |
| GET | `/access/roles` | SA, ITA | roles:read | 8 rôles, nombre de comptes et de permissions |
| GET | `/access/roles/:id` | SA, ITA | roles:read | permissions accordées et catalogue complet |
| PUT | `/access/roles/:id/permissions` | SA | roles:write | `{ permissionIds }` ; SUPER_ADMIN non modifiable ; pas de retrait sur un rôle que l'on détient ; transaction + audit + notifications (2.5) |
| GET | `/access/users` | SA, ITA | users:read | filtres rôle, statut, `authProvider`, recherche ; pagination |
| PUT | `/access/users/:id/roles` | SA, ITA | users:assign_role | `{ roleIds }` ; garde-fous M17 ; compte AD → 409 ; audit (`role.assign` et `role.remove`) |
| PATCH | `/access/users/:id/status` | SA, ITA | users:suspend | `ACTIVE` ou `SUSPENDED` ; garde-fous M17 (dernier SA actif non suspendable par un tiers) ; la suspension révoque les sessions ; audit |
| POST | `/access/users/:id/unlock` | SA, ITA | users:unlock | `LOCKED` uniquement (sinon 409) ; `ACTIVE`, compteur à 0 ; garde-fous M17 ; audit |

**Dashboard** (`DashboardService`, contenu par rôle principal, AppFlow §5) :

| Rôle | Contenu |
|---|---|
| SA | vue consolidée : effectif, état des services, comptes récents (puis activité récente en 2.6) |
| ITA | comptes récemment créés ou suspendus, état des services (puis événements de sécurité en 2.6) |
| ITT | état des services |
| HR | effectif global, répartition par département (barres Recharts), 5 dernières embauches |
| ACC | voir 2.3 |
| DM | voir MVP 1 et 2.2 |
| EMP | voir MVP 1 et 2.2 |
| AUD | rendu à partir de 2.6 (avant 2.6 : uniquement « Mes informations ») |

« État des services » : `GET` interne au dashboard, base de données via `prisma.role.count()`, LDAP « Non configuré » jusqu'en 2.7.

### 6.2 bis Dernier SUPER_ADMIN actif (M17)
- `AccessService` : 403 sur la suspension, la réactivation ou le retrait du rôle SUPER_ADMIN du dernier SA actif par un autre compte.
- `AuthService.registerFailedAttempt` : le verrouillage automatique d'I14 s'applique aussi au dernier SA actif ; au cinquième échec consécutif, le compte passe à `LOCKED`.
- Chaque verrouillage de ce compte produit un `SecurityEvent account_locked` de sévérité `HIGH` (2.6) et une notification `WARNING` aux ITA actifs (2.5). Le rate limiting par IP reste actif.
- Le verrou expire après 15 minutes selon I14. Le seed de développement réinitialise le compte ; le déverrouillage manuel via `/access/users` ne s'applique pas au dernier SA actif et aucun script CLI de déverrouillage n'est prévu.
- La vérification des autres garde-fous « dernier SA actif » reste faite dans la même transaction que la mise à jour.

### 6.3 Frontend
- **`/employees/[id]`** :
  - bouton « Suspendre » activé (statut `ACTIVE`) ou « Réactiver » (`SUSPENDED`), selon `canChangeStatus` ;
  - `ConfirmDialog` destructif, qui précise que le compte et les sessions seront suspendus ;
  - option « Sortie définitive » (`TERMINATED`) dans la même modale.
- **`/access/users`** :
  - tableau : nom, identifiant, rôles (badges), statut, méthode, dernière connexion ;
  - actions par ligne : Rôles (dialogue à cases à cocher), Suspendre / Réactiver, Déverrouiller (si `LOCKED`) ;
  - les actions interdites par M17 ne sont pas rendues (le serveur fait foi).
- **`/access/roles`** : cartes des 8 rôles. **`/access/roles/[id]`** : permissions groupées par ressource, cases à cocher (SA) ou lecture seule (ITA), bouton « Enregistrer » avec modale.
- **Sidebar :** « Accès » (`ShieldCheck`) pour `users:read` ou `roles:read`.

### 6.4 Tests (2.4)
- `test/access.int-spec.ts` : matrice 8 rôles ; chaque garde-fou de M17 et M18, un test par règle ; déverrouillage ; la suspension révoque les sessions ; compte AD → 409.
- `test/last-admin.int-spec.ts` : le dernier SA actif ne peut être suspendu ni rétrogradé par un tiers (403) ; le cinquième échec consécutif le verrouille selon I14 ; le verrou expire après 15 minutes ; le rate limiting par IP s'applique toujours. Le verrouillage s'applique également lorsqu'il existe plusieurs SA actifs.
- `test/employee-status.int-spec.ts` : transaction atomique (en cas d'échec simulé, rien n'est écrit) ; scope DM ; soi-même → 403 ; la réactivation ne réactive pas le compte.
- `test/roles-matrix.int-spec.ts` (**critère 2.4**) : pour chacun des 8 rôles, au moins un endpoint représentatif par module (dashboard, employés, départements, documents, finance, accès), avec résultat attendu, et le contenu du dashboard propre à chaque rôle.
- Mise à jour des tests MVP 1 (Q3) : `CREDENTIALS` dans `helpers.ts` (`direction` → `t.balde`, `manager` → `a.barry`, ajout des 5 nouveaux rôles), `rbac.int-spec`, `modules.int-spec`, `lockout.int-spec`, `employee-number.int-spec`.

---

## 7. Étape 2.5 — Notifications

### 7.1 Endpoints (`notifications/`, rôles `ALL_ROLES`)

| Méthode | Chemin | Permission | Règle |
|---|---|---|---|
| GET | `/notifications` | notifications:read | `userId` = utilisateur courant ; filtre `status` (`read` / `unread` / tous) ; tri `createdAt desc` |
| GET | `/notifications/unread-count` | notifications:read | `{ count }` |
| PATCH | `/notifications/:id/read` | notifications:update | propriétaire, sinon 404 ; idempotent |
| POST | `/notifications/read-all` | notifications:update | propriétaire uniquement |

### 7.2 Déclencheurs (M19)

| Point d'appel | Déclencheur |
|---|---|
| `AuthService.login` (et 2.7 `AdAuthService`) | nouvel appareil : le couple (`userAgent`, `ipAddress`) est absent des sessions **antérieures** de l'utilisateur, et au moins une session antérieure existe |
| `DocumentsService.grantPermission` | `DOCUMENT_SHARED` |
| `AccessService.setUserRoles` | `ROLE_CHANGED` |
| `AccessService.setRolePermissions` | `ROLE_CHANGED` à chaque titulaire du rôle |
| `AuthService.registerFailedAttempt` (verrouillage) | `WARNING` à chaque ITA actif |
| `EmployeesService.create` (si `managerId`) | `INFO` au compte du responsable |

Les notifications sont écrites dans la même transaction que l'action, quand celle-ci est transactionnelle.

### 7.3 Frontend
- **Topbar :** badge réel (`unread-count`, chargé par le layout et rechargé après action), lien vers `/notifications`.
- **`/notifications`** : liste chronologique, icône par type (`ShieldAlert`, `FileText`, `KeyRound`, `TriangleAlert`, `Info`), filtres Toutes / Non lues / Lues, « Tout marquer comme lu ».
- **Dashboard EMP :** « Mes notifications » (5 dernières).

### 7.4 Tests (2.5)
`test/notifications.int-spec.ts` :
- 8 rôles autorisés ;
- isolation (notification d'autrui → 404) ;
- chaque déclencheur ;
- la première connexion ne génère pas d'alerte ;
- **critère 2.5** : partage → visible par le destinataire.

---

## 8. Étape 2.6 — Administration et audit

### 8.1 Compléments d'audit
`AuditService` est branché sur les actions sensibles qui n'écrivent pas encore d'audit : création et modification d'employé (MVP 1). Le test d'exhaustivité porte sur la liste R26.1.

### 8.2 Événements de sécurité
- `SecurityEventsService.record(type, severity, source, description, metadata)`.
- `account_locked` : écrit dans `registerFailedAttempt`.
- `repeated_forbidden` : écrit par un `ForbiddenAuditFilter` global (`@Catch(ForbiddenException)`), qui compte les refus par `userId` dans une fenêtre glissante de 5 minutes, en mémoire, et en émet un seul par fenêtre. Le filtre renvoie ensuite le 403 standard.

### 8.3 Endpoints (rôles SA et AUD)

| Méthode | Chemin | Permission | Filtres |
|---|---|---|---|
| GET | `/audit/logs` | audit:read | `from`, `to`, `actorId`, `action`, `resourceType` ; pagination |
| GET | `/audit/security-events` | security_events:read | `from`, `to`, `severity`, `eventType` |
| GET | `/audit/auth-events` | audit:read | `from`, `to`, `userId`, `eventType` |
| GET | `/documents/:id/history` | documents:history | visibilité du document (SA et AUD), audits `document.*` de ce document |

### 8.4 Frontend
- **`/admin/audit`** :
  - onglets Journal d'activité / Événements de sécurité / Authentifications ;
  - filtres en haut (période, utilisateur, type) ;
  - tableau paginé ;
  - pour un audit, un panneau de détail affiche les anciennes et nouvelles valeurs.
- **`/admin`** redirige vers `/admin/audit`.
- **Sidebar :** « Audit » (`ScrollText`) pour `audit:read`.
- **Section « Historique de consultation »** sur `/documents/[id]` (`documents:history`).
- **Dashboard :**
  - SA : « Activité récente » (5 derniers audits) ;
  - AUD : « Derniers événements d'audit » et « Alertes de sécurité » (HIGH et CRITICAL) ;
  - ITA : « Événements de sécurité récents ».

### 8.5 Tests (2.6)
`test/audit.int-spec.ts` :
- matrice (ITA → 403, M21) ;
- filtres ;
- **immutabilité prouvée** : inventaire de toutes les routes d'écriture (POST, PUT, PATCH, DELETE) ; aucune ne cible `AuditLog` ; nombre d'entrées et contenu inchangés après appel de chaque route d'écriture qui touche l'audit ; aucune route `/audit/*` autre que GET ;
- `account_locked` ;
- `repeated_forbidden` au 5e refus, une seule fois par fenêtre (horloge simulée) ;
- notifications `WARNING` aux ITA ;
- **critère 2.6** : une action de chaque type → entrée d'audit présente, sans champ secret.

---

## 9. Étape 2.7 — Active Directory (LDAP de test)

### 9.1 Configuration (variables d'environnement)

| Variable | Test (Docker) | AD futur — `TODO(AD-REVISION)` |
|---|---|---|
| `AD_LDAP_URL` | `ldaps://127.0.0.1:636` | `ldaps://dc01…:636` |
| `AD_BASE_DN` | `dc=guineafinance,dc=local` | idem |
| `AD_USER_ID_ATTRIBUTE` | `uid` | `sAMAccountName` |
| `AD_MAIL_ATTRIBUTE` | `mail` | `mail` |
| `AD_GROUPS_ATTRIBUTE` | `memberOf` | `memberOf` |
| `AD_GUID_ATTRIBUTE` | `entryUUID` | `objectGUID` (binaire) |
| `AD_SID_ATTRIBUTE` | vide | `objectSid` (binaire) |
| `AD_BIND_DN` / `AD_BIND_PASSWORD` | `cn=svc-ldapreader,ou=ServiceAccounts,…` | compte de service réel |
| `AD_CA_CERT_PATH` | CA du conteneur | CA de DC01 |
| `AD_TIMEOUT_MS` | `3000` | `3000` |

Si une variable obligatoire manque, l'AD est traité comme indisponible (503, `AD_UNREACHABLE`).

### 9.2 LDAP de test
- **`docker-compose.yml`** : service `ldap-test`, image `osixia/openldap` (version épinglée), profil `ad-test`, `127.0.0.1:636:636`, TLS obligatoire, overlay `memberOf`, volume de bootstrap.
- **`infra/ldap-test/`** :
  - `bootstrap.ldif` : les 7 OU, `svc-ldapreader`, environ 6 utilisateurs de test dont les e-mails correspondent aux fiches AD de test, groupes `cn=GFEP-*` (ex. `GFEP-Employes`, `GFEP-Comptables`), un utilisateur sans groupe mappé, un utilisateur sans fiche, un utilisateur dont l'e-mail correspond à un employé qui a un compte LOCAL ;
  - `generate-certs.sh` : CA et certificat serveur auto-signés, non versionnés ;
  - `README.md`.
- **`prisma/seed-ad-test.ts`** (`npm run seed:ad-test`, refuse la production) : fiches Employee de test sans compte local, et `AdGroupRoleMapping` des groupes de test.

### 9.3 Module `ad-auth/`
```
ad-auth.module.ts  ad-auth.controller.ts  ad-auth.service.ts
ldap-client.ts      # interface LdapClient + implémentation ldapjs (M26), LDAPS, timeouts
ad-config.ts        # lecture/validation des variables (§9.1)
ad-mappings.controller.ts  ad-mappings.service.ts
dto/ ad-login.dto.ts  create-ad-mapping.dto.ts
```

**Flux de `AdAuthService.login`** (chaque étape est marquée `TODO(AD-REVISION)` là où une décision reste ouverte) :

| # | Étape | En cas d'échec |
|---|---|---|
| 1 | Bind du compte de service | réseau, timeout ou TLS : `AD_UNREACHABLE` + `SecurityEvent ad_unreachable` → 503 ; identifiants refusés : `AD_SERVICE_BIND_FAILED` → 503 |
| 2 | Recherche `(&(objectClass=person)(<idAttr>=<identifiant échappé RFC 4515>))` | aucun résultat : `AD_USER_NOT_FOUND` → 401 générique |
| 3 | Bind avec le DN de l'utilisateur et son mot de passe | `AD_BIND_FAILED` → 401 générique |
| 4 | Résolution de la fiche Employee : par GUID (`EmployeeIdentity.adObjectGuid`), sinon par `mail` = `professionalEmail` (insensible à la casse) | aucune fiche : `AD_NO_EMPLOYEE_MATCH` → 401 ; fiche liée à un compte LOCAL, ou identifiant ou e-mail déjà pris : `AD_LOCAL_ACCOUNT_CONFLICT` → 401 |
| 5 | Groupes (`memberOf`) → `AdGroupRoleMapping` → rôles | aucun : `AD_NO_ROLE_MAPPING` → 401 |
| 6 | Transaction : upsert `User` (`ACTIVE_DIRECTORY`, `passwordHash` null), `EmployeeIdentity` (`adObjectGuid`, `adSid`, `adUsername`, `adUpn`, `lastSyncAt`), synchronisation des `UserRole` (ajout et retrait), session, `LOGIN_SUCCESS` (`ACTIVE_DIRECTORY`), notification « nouvel appareil » (M19) | — |
| 7 | Cookie identique au flux local | — |

**Règles de sécurité :**
- le mot de passe n'est jamais journalisé ni stocké ;
- un mot de passe vide est refusé par le DTO (évite le bind anonyme) ;
- la connexion LDAP est fermée à chaque fin de flux ;
- le rate limiting utilise un throttler nommé `login-ad` (5 tentatives / 15 min / IP).

### 9.4 Endpoints

| Méthode | Chemin | Rôles | Permission | Règle |
|---|---|---|---|---|
| POST | `/auth/login-ad` | — | `@Public()` (justifié : point d'entrée d'authentification) | flux §9.3 |
| GET | `/access/ad-mappings` | SA, ITA | ad_mappings:read | liste avec rôle |
| POST | `/access/ad-mappings` | SA, ITA | ad_mappings:write | `{ adGroupDn, roleId }` ; DN valide (≤ 500), unique ; rôle SUPER_ADMIN réservé au SA (M22) ; audit |
| DELETE | `/access/ad-mappings/:id` | SA, ITA | ad_mappings:write | même garde-fou SUPER_ADMIN ; audit |

### 9.5 Frontend
- **`/login/ad`** : vrai formulaire (même `AuthCard`). Messages :
  - 401 : « Identifiants invalides. » ;
  - 503 : « Service d'authentification d'entreprise indisponible, réessayez plus tard ou utilisez votre compte local » ;
  - 429 : trop de tentatives ;
  - erreur réseau : service indisponible.
- **`/access/ad-mappings`** : tableau DN → rôle, formulaire d'ajout, suppression avec modale. Sous-lien du menu Accès.
- **« État des services »** : affiche l'état LDAP (Disponible / Indisponible / Non configuré).

### 9.6 Tests (2.7)
- **`npm test`** (sans Docker) :
  - `ad-auth.service.spec.ts` avec un `LdapClient` simulé : chaque branche du tableau §9.3, l'`AuthEvent` attendu, l'absence de repli local, l'échappement du filtre ;
  - `ad-mappings.int-spec.ts` : matrice et garde-fou SUPER_ADMIN ;
  - `route-access` : `login-ad` ajouté aux routes publiques autorisées.
- **`npm run test:ad`** (LDAP Docker démarré, **critère 2.7**) :
  - connexion réussie avec le bon rôle ;
  - deuxième connexion par GUID ;
  - chaque cas de refus ;
  - conteneur arrêté → 503 + `AD_UNREACHABLE` + `SecurityEvent`.

---

## 10. Composants frontend nouveaux ou étendus

| Composant | Usage | Règles |
|---|---|---|
| `ui/dialog.tsx`, `ConfirmDialog` | confirmations | Échap et clic extérieur ferment, sauf en variante destructive (fermeture explicite, `04` §4.5) ; focus piégé ; tokens |
| `ui/tabs.tsx` | `/admin/audit` | navigation au clavier ; tokens |
| `ui/checkbox.tsx` | rôles, matrice | label visible |
| `ui/file-input.tsx` | dépôt | label, aide (formats, 10 Mo), erreur en dessous |
| `ConfidentialityBadge`, `ValidationBadge`, `TransactionStatusBadge`, `InvoiceStatusBadge`, `AccountStatusBadge` | statuts | pastille sémantique + texte en premier plan (I13, AA) |
| `MoneyAmount` | montants | `fr-FR`, chiffres tabulaires, devise |
| `ServiceStatusCard` | dashboards ITA, ITT, SA | icônes `Database`, `Network` ; état sémantique |

Le test de tokens (`theme-contrast.test.tsx`) couvre automatiquement les nouveaux fichiers. Chaque nouveau badge reçoit un test de mapping de variante.

---

## 11. Gestion des erreurs (complément de `gfep-lot0-mvp1/design.md` §10)

| Situation | HTTP | Message |
|---|---|---|
| Fichier trop volumineux ou format refusé | 400 | message métier (`04` §7) |
| Document non visible ou inexistant | 404 | « Cette ressource n'existe pas ou a été supprimée. » |
| Transition de statut interdite (document, transaction, compte) | 409 | « Cette action n'est pas possible dans l'état actuel. » |
| Transition de facture interdite | 400 | « Ce changement de statut n'est pas autorisé pour cette facture. » |
| Garde-fou d'anti-escalade | 403 | générique |
| Compte AD : modification des rôles | 409 | « Les rôles de ce compte sont gérés par l'annuaire d'entreprise. » |
| AD injoignable | 503 | message d'AppFlow §3.2 |
