# DECISIONS — MVP 2 (étapes 2.1 à 2.7)

Ce fichier complète `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md` (Phase 0 et MVP 1, entrées C1–C4, D1–D10, I1–I22), toujours en vigueur. Les entrées ci-dessous sont numérotées M1, M2… Leur source est indiquée : réponse de l'utilisateur (Q0–Q19 et clarifications du 2026-11-05), document de référence, ou règle dérivée.

Les entrées marquées **(dérivé — validé le 2026-11-05)** ne viennent d'aucun document ni d'aucune réponse explicite. Je les ai déduites des règles générales (interdiction par défaut, aucune vulnérabilité, sécurité). Elles doivent être confirmées lors de la validation de cette spec.

---

## Cadre

### M1 — Périmètre et ordre
- Le MVP 2 suit l'ordre exact de `06-Implementation-Plan.md` : 2.1 → 2.7, sans réordonnancement, fusion ni saut.
- Une étape ne commence que si le critère de passage de la précédente est vérifié concrètement.
- Aucune vulnérabilité volontaire, aucun `LAB_MODE` / `APP_MODE`, aucun vrai Active Directory.
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

**« État des services »** (dashboards IT_ADMINISTRATOR, IT_TECHNICIAN, SUPER_ADMIN) :
- **base de données** : requête Prisma triviale, sans SQL brut ;
- **LDAP** : bind du compte de service, avec un timeout de 3 s. Le résultat est mis en cache 30 s **(dérivé — validé le 2026-11-05)**.
- Avant 2.7, le LDAP s'affiche « Non configuré ».

### M21 — L'IT_ADMINISTRATOR n'a pas accès à `/admin/audit` (clarification)
- PRD §4.9 et AppFlow §3.10, plus précis que le persona PRD §3, l'emportent : `/admin/audit` est réservé à l'AUDITOR (lecture) et au SUPER_ADMIN.
- L'IT_ADMINISTRATOR voit les événements de sécurité récents **sur son dashboard uniquement** (AppFlow §5).

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
- Suffixe `dc=guineafinance,dc=local`.
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

Décisions ouvertes (Q19 reportée), toutes marquées `TODO(AD-REVISION)` dans le code de 2.7 :

1. **Rattachement AD → Employee :** provisoirement par `mail = professionalEmail`, puis par GUID. À confirmer selon l'attribut fiable du vrai annuaire (`mail`, `employeeID`, `userPrincipalName`).
2. **Attributs réels :** identifiant `sAMAccountName` (test : `uid`), GUID `objectGUID`, à convertir du binaire (test : `entryUUID`), SID `objectSid`, à convertir du binaire (test : absent), groupes `memberOf`.
3. **Mapping réel des groupes AD → rôles :** les groupes de test (`cn=GFEP-*`) sont fictifs. Il faut définir les groupes de production et l'éventuelle imbrication de groupes (`memberOf` ne la résout pas).
4. **Comptes de service :**
   - `svc-ldapreader` en lecture seule ;
   - le second compte applicatif distinct exigé par le TRD §8 n'est pas créé, car aucun usage n'existe en MVP 2 ;
   - droits minimaux et rotation des mots de passe à définir.
5. **Certificat LDAPS :** en test, une CA auto-signée générée pour le conteneur. En production, la CA du DC01 et la validation du nom d'hôte.
6. **Employé ayant déjà un compte LOCAL :** refus en MVP 2. Une procédure de migration d'un compte LOCAL vers un compte AD est à définir.
7. **Synchronisation des rôles :** les rôles sont écrasés depuis les groupes à chaque connexion. La révocation d'un compte supprimé de l'AD hors connexion n'est pas traitée.
8. **Verrouillage et politique de mot de passe :** déléguée à l'AD. L'articulation avec les `AuthEvent` locaux est à définir.
9. **Bibliothèque LDAP :** voir M26.
