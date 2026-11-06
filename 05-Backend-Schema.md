# Backend Schema — Guinea Finance Enterprise Portal (GFEP)
### Base de données, relations, flux d'authentification
Version 1.0 — 2026-11-05

---

## 1. Objet

Ce document définit le schéma de base de données complet (PostgreSQL via Prisma), les relations entre entités, et le flux d'authentification détaillé. Il est la référence que l'agent de développement doit suivre pour générer `schema.prisma` et les migrations.

## 2. Organisation en 7 domaines

| Domaine | Responsabilité |
| --- | --- |
| Identity | Comptes, identités AD, sessions |
| Organization | Départements, postes, employés, hiérarchie |
| Access Control | Rôles, permissions, RBAC |
| Documents | Fichiers et autorisations documentaires |
| Finance | Transactions et factures fictives |
| Application | Notifications, événements d'authentification |
| Security & Audit | Journaux d'audit, événements de sécurité |

## 3. Schéma Prisma complet

```prisma
// ============================================================
// DOMAIN: IDENTITY
// ============================================================

enum AuthProvider {
  LOCAL
  ACTIVE_DIRECTORY
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  LOCKED
}

model User {
  id               String       @id @default(uuid())
  username         String       @unique
  email            String       @unique
  passwordHash     String?      // null si auth_provider = ACTIVE_DIRECTORY
  authProvider     AuthProvider @default(LOCAL)
  status           UserStatus   @default(ACTIVE)
  failedLoginCount Int          @default(0)
  lastLoginAt      DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  employeeIdentity EmployeeIdentity?
  sessions         Session[]
  userRoles        UserRole[]
  authEvents       AuthEvent[]
  notifications    Notification[]
  auditLogsAsActor AuditLog[]        @relation("AuditActor")

  @@index([email])
  @@map("users")
}

model EmployeeIdentity {
  id           String   @id @default(uuid())
  userId       String   @unique
  employeeId   String   @unique
  adObjectGuid String?  @unique
  adSid        String?  @unique
  adUsername   String?
  adUpn        String?
  lastSyncAt   DateTime?

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@map("employee_identities")
}

model Session {
  id               String    @id @default(uuid())
  userId           String
  sessionTokenHash String    @unique
  ipAddress        String
  userAgent        String
  expiresAt        DateTime
  revokedAt        DateTime?
  createdAt        DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

// Table de correspondance groupe AD -> rôle applicatif
model AdGroupRoleMapping {
  id        String @id @default(uuid())
  adGroupDn String @unique
  roleId    String

  role Role @relation(fields: [roleId], references: [id])

  @@map("ad_group_role_mapping")
}

// ============================================================
// DOMAIN: ORGANIZATION
// ============================================================

enum EmploymentStatus {
  ACTIVE
  SUSPENDED
  TERMINATED
}

model Department {
  id          String   @id @default(uuid())
  name        String   @unique
  code        String   @unique
  description String?
  managerId   String?  @unique
  createdAt   DateTime @default(now())

  manager   Employee?  @relation("DepartmentManager", fields: [managerId], references: [id])
  employees Employee[] @relation("DepartmentEmployees")
  positions Position[]
  documentCategories DocumentCategory[]
  transactions       Transaction[]
  invoices           Invoice[]

  @@map("departments")
}

model Position {
  id              String @id @default(uuid())
  title           String
  description     String?
  departmentId    String
  hierarchyLevel  Int     // 1 = direction, plus le chiffre augmente plus le niveau est opérationnel

  department Department @relation(fields: [departmentId], references: [id])
  employees  Employee[]

  @@map("positions")
}

model Employee {
  id                 String           @id @default(uuid())
  employeeNumber     String           @unique // ex: GF-2026-001
  firstName          String
  lastName           String
  professionalEmail  String           @unique
  phone              String?
  departmentId       String
  positionId         String
  managerId          String?
  hireDate           DateTime
  employmentStatus   EmploymentStatus @default(ACTIVE)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  department        Department        @relation("DepartmentEmployees", fields: [departmentId], references: [id])
  position          Position          @relation(fields: [positionId], references: [id])
  manager           Employee?         @relation("EmployeeHierarchy", fields: [managerId], references: [id])
  directReports      Employee[]        @relation("EmployeeHierarchy")
  managesDepartment  Department?       @relation("DepartmentManager")
  identity           EmployeeIdentity?
  ownedDocuments      Document[]        @relation("DocumentOwner")

  @@index([departmentId])
  @@index([managerId])
  @@map("employees")
}

// ============================================================
// DOMAIN: ACCESS CONTROL
// ============================================================

model Role {
  id          String @id @default(uuid())
  name        String @unique // ex: SUPER_ADMIN, HR_MANAGER, EMPLOYEE
  description String

  userRoles       UserRole[]
  rolePermissions RolePermission[]
  adGroupMappings AdGroupRoleMapping[]

  @@map("roles")
}

model Permission {
  id          String @id @default(uuid())
  resource    String // ex: "employees", "documents", "finance"
  action      String // ex: "read", "write", "delete", "approve"
  description String

  rolePermissions RolePermission[]

  @@unique([resource, action])
  @@map("permissions")
}

model UserRole {
  userId     String
  roleId     String
  assignedBy String
  assignedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id])

  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

// ============================================================
// DOMAIN: DOCUMENTS
// ============================================================

enum ConfidentialityLevel {
  PUBLIC
  INTERNAL
  CONFIDENTIAL
  RESTRICTED
}

enum DocumentPermissionType {
  READ
  WRITE
  DELETE
}

enum DocumentValidationStatus {
  PENDING
  VALIDATED
  REJECTED
}

model DocumentCategory {
  id           String      @id @default(uuid())
  name         String      @unique
  description  String?
  departmentId String?

  department Department? @relation(fields: [departmentId], references: [id])
  documents  Document[]

  @@map("document_categories")
}

model Document {
  id                   String               @id @default(uuid())
  title                String
  description          String?
  categoryId           String
  ownerId              String
  storagePath          String
  mimeType             String
  fileSize             Int
  confidentialityLevel ConfidentialityLevel @default(INTERNAL)
  validationStatus     DocumentValidationStatus @default(PENDING)
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  category    DocumentCategory      @relation(fields: [categoryId], references: [id])
  owner       Employee              @relation("DocumentOwner", fields: [ownerId], references: [id])
  permissions DocumentPermission[]

  @@index([categoryId])
  @@index([ownerId])
  @@map("documents")
}

model DocumentPermission {
  id           String                  @id @default(uuid())
  documentId   String
  userId       String
  permission   DocumentPermissionType
  grantedBy    String
  grantedAt    DateTime                @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, userId, permission])
  @@map("document_permissions")
}

// ============================================================
// DOMAIN: FINANCE
// ============================================================

enum TransactionType {
  INCOME
  EXPENSE
}

enum TransactionStatus {
  PENDING
  VALIDATED
  REJECTED
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  CANCELLED
}

model Transaction {
  id              String             @id @default(uuid())
  reference       String             @unique
  transactionType TransactionType
  amount          Decimal            @db.Decimal(14, 2)
  currency        String             @default("GNF")
  description     String?
  createdBy       String
  status          TransactionStatus  @default(PENDING)
  createdAt       DateTime           @default(now())
  departmentId    String?

  department Department? @relation(fields: [departmentId], references: [id])

  @@index([createdBy])
  @@index([departmentId])
  @@map("transactions")
}

model Invoice {
  id            String        @id @default(uuid())
  invoiceNumber String        @unique
  clientName    String
  amount        Decimal       @db.Decimal(14, 2)
  currency      String        @default("GNF")
  dueDate       DateTime
  status        InvoiceStatus @default(DRAFT)
  createdBy     String
  createdAt     DateTime      @default(now())
  departmentId  String?

  department Department? @relation(fields: [departmentId], references: [id])

  @@index([createdBy])
  @@index([departmentId])
  @@map("invoices")
}

// ============================================================
// DOMAIN: APPLICATION
// ============================================================

enum NotificationType {
  INFO
  WARNING
  SECURITY
  DOCUMENT_SHARED
  ROLE_CHANGED
}

model Notification {
  id        String           @id @default(uuid())
  userId    String
  title     String
  message   String
  type      NotificationType
  readAt    DateTime?
  createdAt DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@map("notifications")
}

enum AuthEventType {
  LOGIN_SUCCESS
  LOGIN_FAILED
  LOGOUT
  ACCOUNT_LOCKED
  AD_BIND_FAILED
  AD_UNREACHABLE
  AD_SERVICE_BIND_FAILED
  AD_USER_NOT_FOUND
  AD_NO_EMPLOYEE_MATCH
  AD_NO_ROLE_MAPPING
  AD_LOCAL_ACCOUNT_CONFLICT
}

model AuthEvent {
  id                  String        @id @default(uuid())
  userId              String?
  authenticationMethod AuthProvider
  eventType           AuthEventType
  sourceIp            String
  timestamp           DateTime      @default(now())

  user User? @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([timestamp])
  @@map("auth_events")
}

// ============================================================
// DOMAIN: SECURITY & AUDIT
// ============================================================

model AuditLog {
  id           String   @id @default(uuid())
  actorId      String
  action       String   // ex: "employee.update", "role.assign"
  resourceType String   // ex: "Employee", "Document"
  resourceId   String
  oldValues    Json?
  newValues    Json?
  sourceIp     String
  timestamp    DateTime @default(now())

  actor User @relation("AuditActor", fields: [actorId], references: [id])

  @@index([resourceType, resourceId])
  @@index([timestamp])
  @@map("audit_logs")
}

enum SecuritySeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model SecurityEvent {
  id          String           @id @default(uuid())
  eventType   String
  severity    SecuritySeverity
  source      String
  description String
  metadata    Json?
  timestamp   DateTime         @default(now())

  @@index([severity, timestamp])
  @@map("security_events")
}

// Catalogue des scénarios pédagogiques (hors périmètre de ce document produit,
// détaillé dans les documents Enterprise Breach — table listée ici pour la cohérence du schéma)
model LabScenario {
  id                     String   @id @default(uuid())
  scenarioCode           String   @unique // ex: WEB-01, AD-02
  name                   String
  vulnerabilityCategory  String
  description            String
  mode                   String   // "lab" | "secure"
  enabled                Boolean  @default(false)
  createdAt              DateTime @default(now())

  executions ScenarioExecution[]

  @@map("lab_scenarios")
}

model ScenarioExecution {
  id                String    @id @default(uuid())
  scenarioId        String
  startedAt         DateTime  @default(now())
  completedAt       DateTime?
  result            String?
  evidenceReference String?

  scenario LabScenario @relation(fields: [scenarioId], references: [id])

  @@map("scenario_executions")
}
```

## 4. Relations principales — synthèse

| Relation | Type | Signification |
| --- | --- | --- |
| `User` ↔ `EmployeeIdentity` | 1–1 | Un compte applicatif correspond à au plus une identité employé |
| `Employee` ↔ `Department` | N–1 | Chaque employé appartient à un département |
| `Employee` ↔ `Employee` (manager) | N–1 auto-référencée | Hiérarchie employé/responsable |
| `Department` ↔ `Employee` (manager) | 1–1 | Un département a un responsable désigné |
| `User` ↔ `Role` via `UserRole` | N–N | Un compte peut avoir plusieurs rôles |
| `Role` ↔ `Permission` via `RolePermission` | N–N | Un rôle regroupe plusieurs permissions |
| `Document` ↔ `User` via `DocumentPermission` | N–N | Permissions fines par document et par utilisateur |
| `AdGroupRoleMapping` ↔ `Role` | N–1 | Plusieurs groupes AD peuvent mapper vers le même rôle |

## 5. Flux d'authentification détaillé

### 5.1 Authentification locale

```
1. POST /auth/login { username, password }
2. Backend recherche User par username (status != LOCKED)
3. Vérifie passwordHash avec argon2.verify()
4. Succès :
   - reset failedLoginCount à 0
   - crée Session (sessionTokenHash, expiresAt)
   - crée AuthEvent (LOGIN_SUCCESS)
   - pose cookie httpOnly avec le token en clair (seul endroit où il existe en clair)
   - retourne profil utilisateur + rôles
5. Échec :
   - incrémente failedLoginCount
   - si failedLoginCount >= 5 : status = LOCKED, AuthEvent (ACCOUNT_LOCKED)
   - crée AuthEvent (LOGIN_FAILED)
   - retourne erreur générique "Identifiants invalides"
```

### 5.2 Authentification Active Directory

```
1. POST /auth/login-ad { username, password }
2. Backend bind LDAPS avec svc-ldapreader (lecture seule)
3. Recherche du DN de l'utilisateur dans l'annuaire
   - échec de connexion à DC01 → AuthEvent (AD_UNREACHABLE) → erreur "Service indisponible"
4. Second bind LDAPS avec les identifiants de l'utilisateur lui-même
   - échec → AuthEvent (AD_BIND_FAILED) → erreur générique "Identifiants invalides"
5. Succès : lecture de l'attribut memberOf
6. Pour chaque groupe AD, recherche dans AdGroupRoleMapping -> liste de Role
7. Upsert du User (authProvider = ACTIVE_DIRECTORY, pas de passwordHash)
   et de son EmployeeIdentity (adObjectGuid, adSid, adUsername, adUpn, lastSyncAt)
8. Synchronisation des UserRole selon le mapping (ajout/retrait pour refléter l'état AD actuel)
9. Crée Session, AuthEvent (LOGIN_SUCCESS), pose le cookie, retourne le profil
```

### 5.3 Vérification de session (middleware, chaque requête protégée)

```
1. Lit le cookie de session
2. Hash le token reçu, recherche la Session correspondante (sessionTokenHash)
3. Vérifie : non révoquée (revokedAt == null), non expirée (expiresAt > now)
4. Si invalide : 401, le frontend redirige vers /login
5. Si valide : charge User + UserRole[] + Permission[] (via Role), injecte dans le contexte de la requête
```

### 5.4 Vérification d'autorisation (par endpoint)

```
1. Le guard de rôle vérifie que l'un des rôles de l'utilisateur figure dans @Roles(...) du contrôleur
2. Le guard de permission vérifie, via Permission (resource, action), que l'utilisateur a le droit
   précis demandé (ex: "documents:delete")
3. Pour les ressources avec permission fine (ex: Document), une vérification applicative
   supplémentaire s'exécute dans le service (propriétaire, ou DocumentPermission explicite)
4. Échec à n'importe quelle étape → 403, AuditLog optionnel si l'action est sensible
```

## 6. Index et contraintes importantes

- Unicité stricte sur `username`, `email`, `employeeNumber`, `professionalEmail`, `invoiceNumber`, `reference` (transactions).
- `onDelete: Cascade` limité aux relations de dépendance stricte (ex: suppression d'un `User` supprime ses `Session`) — jamais en cascade sur `Employee` → `Document` (un document ne doit pas disparaître si son propriétaire est supprimé ; prévoir une règle de réaffectation côté service applicatif plutôt qu'une suppression en cascade).
- Index sur toutes les colonnes de clé étrangère fréquemment filtrées (`departmentId`, `userId`, `categoryId`) et sur les colonnes de recherche temporelle (`timestamp`, `createdAt` pour les logs).

## 7. Jeu de données initial (seed) — volumétrie cible

| Table | Volumétrie |
| --- | --- |
| `departments` | 6 |
| `positions` | ~18 (3 par département en moyenne) |
| `employees` | 40 |
| `users` | 40 (un par employé) |
| `roles` | 8 |
| `permissions` | 30 à 40 |
| `document_categories` | 6 |
| `documents` | 50 |
| `invoices` | 30 |
| `transactions` | 100 |

Le script de seed (Prisma seed script) doit créer ces données dans l'ordre des dépendances : `departments` → `positions` → `employees` → `users` → `roles`/`permissions` → `user_roles`/`role_permissions` → `document_categories` → `documents` → `invoices`/`transactions`.
