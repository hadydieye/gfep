# Design Document — Lot 0 (nettoyage) + MVP 1 (étapes 1.1 à 1.5)
## Guinea Finance Enterprise Portal (GFEP)

---

## Table des matières

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Lot 0 — Nettoyage de la fondation](#2-lot-0--nettoyage-de-la-fondation)
3. [Étape 1.1 — Module Auth](#3-étape-11--module-auth)
4. [Étape 1.2 — Module RBAC](#4-étape-12--module-rbac)
5. [Étape 1.3 — Module Dashboard](#5-étape-13--module-dashboard)
6. [Étape 1.4 — Module Employés](#6-étape-14--module-employés)
7. [Étape 1.5 — Module Départements](#7-étape-15--module-départements)
8. [Seed MVP 1](#8-seed-mvp-1)
9. [Schéma de données (tables concernées)](#9-schéma-de-données-tables-concernées)
10. [Gestion des erreurs](#10-gestion-des-erreurs)
11. [Correctness Properties](#11-correctness-properties)

---

## 1. Vue d'ensemble de l'architecture

L'architecture du lot respecte le schéma à trois couches défini dans `02-TRD.md` :

```
[ Navigateur ]
      |
      | HTTPS (same-origin via Next.js rewrites)
      v
[ Next.js 15 — App Router — apps/frontend ]
      |
      | /api/v1/* rewrite → http://localhost:3001
      v
[ NestJS 12 ESM — apps/backend ]
   |
   v
[ PostgreSQL 16 via Prisma 5 ]
```

**Règles d'architecture non négociables pour ce lot :**
- Le frontend ne communique jamais directement avec PostgreSQL.
- Toutes les requêtes de données passent par les rewrites Next.js, rendant le cookie de session httpOnly same-origin.
- Chaque endpoint sensible est protégé par deux guards côté serveur : RoleGuard + PermissionGuard.
- Aucune requête SQL brute — Prisma exclusivement.
- Aucun secret en dur dans le code source — variables d'environnement uniquement.

**Préfixe global de l'API :** `/api/v1` (configuré dans `main.ts` via `app.setGlobalPrefix('api/v1')`).

**ESM / NestJS 12 :** l'ensemble du backend tourne avec `"type": "module"`. Tous les imports internes utilisent le suffixe `.js` (résolution ESM). Les decorateurs NestJS fonctionnent via `reflect-metadata` importé dans `main.ts`.

---

## 2. Lot 0 — Nettoyage de la fondation

### 2.1 Suppression du code mort backend

**Fichiers à supprimer :**
- `apps/backend/src/app.controller.ts`
- `apps/backend/src/app.service.ts`
- `apps/backend/src/app.controller.spec.ts`

Ces trois fichiers sont du code de scaffolding généré par `nest new` ; ils ne sont référencés par aucun module actif.

**État cible de `AppModule` :**

```typescript
// apps/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    // AuthModule et les modules métier seront ajoutés dans les étapes suivantes
  ],
})
export class AppModule {}
```

### 2.2 Consolidation des linters

**Backend — oxlint uniquement :**
- Supprimer `apps/backend/.eslintrc.js`.
- Retirer des `devDependencies` du `package.json` backend : `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`.
- Conserver : `oxlint`, `oxlint-tsgolint`.
- Le script `"lint": "oxlint --type-aware src/ test/"` reste inchangé.

**Frontend — ESLint uniquement :**
- Conserver `eslint` et `eslint-config-next` dans `devDependencies`.
- Le script `"lint": "next lint"` reste inchangé.

**Vérification :** `npm run lint` depuis la racine du monorepo exécute oxlint pour le backend et ESLint pour le frontend sans erreur de configuration.

### 2.3 Source unique des tokens Tailwind v4

La source de vérité est le bloc `@theme` de `apps/frontend/src/app/globals.css`. Ce fichier définit déjà l'ensemble des tokens GFEP (palette, espacement, typographie, radius). 

Aucune directive `@config` n'est présente dans `globals.css` : Tailwind v4 ne lit donc pas `tailwind.config.ts`. Si ce fichier est conservé, il est annoté comme documentation/référence uniquement.

**Tokens existants (déjà en place, aucune modification requise) :**
- Couleurs primaire/secondaire, background, foreground, border, sémantiques.
- Espacement en base 4px.
- Police : `--font-sans: var(--font-inter, ...)`.
- Radius : `--radius-card: 8px`.

### 2.4 Alignement de la version Node

- `.nvmrc` : `22` (déjà en place).
- `engines.node` dans le `package.json` racine : `>=22` (à vérifier et aligner si absent).
- Aucune divergence entre les outils.

### 2.5 Configuration des rewrites Next.js

**`apps/frontend/next.config.ts` — état cible :**

```typescript
import type { NextConfig } from 'next';

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

**`apps/frontend/.env.local` :**

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

Le cookie de session posé par le backend est reçu en same-origin par le frontend : aucun CORS avec `credentials` n'est nécessaire.

### 2.6 Installation de lucide-react

`lucide-react` est ajouté aux `dependencies` du frontend avec une version caret-bounded (`^0.xxx`). Lucide est la seule source d'icônes dans toute l'interface — aucun emoji dans la navigation, les boutons ou les titres.

### 2.7 Prisma en devDependencies et nettoyage du docker-compose

**`apps/backend/package.json` :**
- `prisma` (le CLI) déplacé de `dependencies` vers `devDependencies`.
- `@prisma/client` reste en dépendance runtime.

**`docker-compose.yml` :**
- Suppression du champ `version:` obsolète en haut du fichier.
- Service PostgreSQL 16 conservé, avec les credentials lus depuis `.env`.

### 2.8 Redirection de la page d'accueil

**`apps/frontend/src/app/page.tsx` — état cible :**

La page `/` est convertie en composant de redirection server-side :

```typescript
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session'; // helper à créer à l'étape 1.1

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
```

Le contenu Next.js par défaut (logo Vercel, liens de documentation) est supprimé.

---

## 3. Étape 1.1 — Module Auth

### 3.1 Structure du module AuthModule

```
apps/backend/src/
└── auth/
    ├── auth.module.ts
    ├── auth.controller.ts
    ├── auth.service.ts
    ├── session.middleware.ts        # Middleware de session
    ├── session.guard.ts             # Guard de session (endpoints protégés)
    ├── dto/
    │   ├── login.dto.ts
    │   └── auth-response.dto.ts
    └── decorators/
        └── current-user.decorator.ts
```

**`AuthModule` importe :**
- `PrismaModule` (via module global ou import direct)
- `ConfigModule` (pour lire `SESSION_COOKIE_NAME`, `NODE_ENV`)

**`AuthModule` exporte :**
- `AuthService` (consommé par les guards dans RbacModule et les modules métier)

**Enregistrement du middleware dans `AppModule` :**

```typescript
// Dans AppModule.configure(consumer: MiddlewareConsumer)
consumer
  .apply(SessionMiddleware)
  .exclude({ path: 'api/v1/auth/login', method: RequestMethod.POST })
  .forRoutes('*');
```

Le middleware de session est exclu de `POST /auth/login` (pas de session requise pour se connecter).

### 3.2 Rate Limiting

**Bibliothèque :** `@nestjs/throttler` + adaptateur mémoire (pour MVP 1).

**Configuration dans `AppModule` :**

```typescript
ThrottlerModule.forRoot([
  {
    name: 'login',
    ttl: 15 * 60 * 1000, // 15 minutes en ms
    limit: 5,
  },
])
```

Le guard `ThrottlerGuard` est appliqué **uniquement** sur `POST /auth/login` via un décorateur `@UseGuards(ThrottlerGuard)` + `@Throttle({ login: { limit: 5, ttl: 900000 } })`. Il est basé sur l'adresse IP source.

**Réponse en cas de dépassement :** HTTP 429, corps `{ "statusCode": 429, "message": "Trop de tentatives. Réessayez dans quelques minutes." }`.

### 3.3 DTOs d'authentification

**`LoginDto` :**

```typescript
// login.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
```

**`AuthResponseDto` :**

```typescript
// auth-response.dto.ts
export class AuthResponseDto {
  id: string;
  username: string;
  email: string;
  status: string;
  roles: RoleDto[];
  permissions: PermissionDto[];
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    departmentId: string;
  } | null;
}
```

**Activation globale dans `main.ts` :**

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

### 3.4 Flux de login — `POST /api/v1/auth/login`

```
1. ThrottlerGuard vérifie le quota IP (5 req / 15 min)
   → si dépassé : 429

2. ValidationPipe valide LoginDto (whitelist + forbidNonWhitelisted)
   → si invalide : 400

3. AuthService.login(dto, req):
   a. Recherche User par username (Prisma)
   b. Si User non trouvé OU status = LOCKED → retour message générique, sans distinguer les cas
   c. argon2.verify(user.passwordHash, dto.password)
      → si faux :
         - incrémente failedLoginCount
         - si failedLoginCount >= 5 : status = LOCKED, crée AuthEvent(ACCOUNT_LOCKED)
         - crée AuthEvent(LOGIN_FAILED)
         - retour message générique (401)
      → si vrai :
         - reset failedLoginCount = 0
         - lastLoginAt = now()
         - génère sessionToken = crypto.randomBytes(48).toString('hex')
         - sessionTokenHash = SHA-256(sessionToken)  [stocké en base]
         - crée Session { sessionTokenHash, ipAddress, userAgent, expiresAt = now + 8h }
         - crée AuthEvent(LOGIN_SUCCESS)
         - pose cookie httpOnly avec sessionToken (valeur en clair, unique transmission)
         - retourne AuthResponseDto (profil + rôles + permissions)
```

**Note sur le hash du token de session :** le token brut est un aléa cryptographique (48 bytes = 96 chars hex). Le hash stocké en base est SHA-256 du token brut (via `crypto.createHash('sha256')`). argon2 n'est pas utilisé pour le token de session — argon2 est réservé aux mots de passe.

### 3.5 Flux de logout — `POST /api/v1/auth/logout`

```
1. SessionMiddleware valide la session (via cookie)
   → si invalide : 401
2. AuthService.logout(sessionId):
   - revokedAt = now() sur la Session courante
   - crée AuthEvent(LOGOUT)
3. Efface le cookie côté client (Set-Cookie avec Max-Age=0)
4. Retourne 204 No Content
```

### 3.6 Flux de /me — `GET /api/v1/auth/me`

```
1. SessionMiddleware valide la session
   → si invalide : 401
2. Retourne AuthResponseDto (profile, rôles, permissions, employee identity)
```

### 3.7 Middleware et Guard de session

**`SessionMiddleware` (s'exécute sur toutes les routes sauf /auth/login) :**

```
1. Lire le cookie SESSION_COOKIE_NAME
2. Si absent → req.user = null, passer au suivant
3. Calculer SHA-256 du token reçu
4. Prisma : findUnique Session where { sessionTokenHash }
   include: { user: { include: { userRoles: { include: { role: { include: { rolePermissions: true } } } } } } }
5. Si non trouvé, revokedAt != null, ou expiresAt < now() → req.user = null
6. Sinon → req.user = { user, roles: [...], permissions: [...] }
```

**`SessionGuard` (appliqué sur les routes protégées) :**

```
1. Si req.user == null → throw UnauthorizedException (401)
2. Sinon → passer
```

**Décorateur `@CurrentUser()` :**

```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### 3.8 Écran `/login` — Frontend

**Structure des fichiers frontend :**

```
apps/frontend/src/
├── app/
│   ├── login/
│   │   ├── page.tsx          # Page de connexion locale
│   │   └── ad/
│   │       └── page.tsx      # Page AD — notice "indisponible" en MVP 1
│   └── (auth)/               # Route group pour les pages protégées
│       ├── layout.tsx        # Layout avec sidebar + topbar
│       └── dashboard/
│           └── page.tsx
├── components/
│   └── auth/
│       └── login-form.tsx    # Formulaire client (React Hook Form + Zod)
└── lib/
    ├── auth/
    │   ├── session.ts        # Helper getSession() côté serveur
    │   └── actions.ts        # Server Actions login/logout
    └── api/
        └── client.ts         # Wrapper fetch vers /api/v1
```

**Composants et layout de `/login` :**

La page `/login` est une page serveur Next.js. Elle rend :
- Un layout centré verticalement (100vh), fond `--color-background-main`.
- Une carte centrale (fond `--color-background-surface`, bordure `--color-border`, `border-radius: 8px`, ombre très subtile).
- Contenu de la carte :
  - Logo textuel "GUINEA FINANCE" en police Inter 600, couleur `--color-primary`.
  - Sous-titre "Portail de gestion interne" en texte secondaire.
  - `<LoginForm />` — composant client.
  - Lien "Se connecter avec le compte d'entreprise" → `/login/ad`.

**`LoginForm` (composant client) :**
- React Hook Form + Zod pour la validation client.
- Schéma Zod : `username` non vide, `password` non vide.
- Champs : `<Input>` shadcn/ui customisé GFEP — label visible au-dessus, jamais uniquement en placeholder.
- Bouton primaire "Se connecter" (couleur `--color-primary`, texte blanc).
- État soumission : bouton en loading (spinner Lucide `Loader2` + "Connexion en cours...").
- Erreur : message affiché sous le formulaire, couleur `--color-error`, sans révéler si le compte existe.
- Succès : `router.push('/dashboard')`.
- Si déjà connecté (détection via Server Component parent) : redirect vers `/dashboard`.

**Transport des credentials :**
- Le formulaire soumet via `fetch('/api/v1/auth/login', { method: 'POST', credentials: 'include', body: JSON.stringify(dto) })`.
- Le cookie est posé par le backend via l'en-tête `Set-Cookie`, géré automatiquement par le navigateur (aucune manipulation manuelle du token côté client).

**Page `/login/ad` en MVP 1 :**
- Affiche un message : "L'authentification par compte d'entreprise n'est pas disponible pour le moment. Utilisez votre compte local ou contactez l'administrateur."
- Bouton "Retour à la connexion locale" → `/login`.
- Pas de formulaire, pas d'appel API.

### 3.9 Gestion de session côté frontend — `lib/auth/session.ts`

Helper serveur qui lit le cookie de session et interroge `GET /api/v1/auth/me` pour récupérer le profil :

```
getSession():
  1. Lit le cookie depuis les headers de la requête serveur (cookies() de Next.js)
  2. Si absent → retourne null
  3. Appelle GET /api/v1/auth/me (en passant le cookie dans les headers)
  4. Si 401 → retourne null
  5. Retourne le profil utilisateur
```

Ce helper est utilisé dans les layouts de route group pour protéger les pages serveur.

---

## 4. Étape 1.2 — Module RBAC

### 4.1 Structure du module RbacModule

```
apps/backend/src/
└── rbac/
    ├── rbac.module.ts
    ├── guards/
    │   ├── roles.guard.ts
    │   └── permission.guard.ts
    └── decorators/
        ├── roles.decorator.ts
        └── permission.decorator.ts
```

`RbacModule` est global (`@Global()`) afin que les guards soient disponibles dans tous les modules sans import explicite.

### 4.2 Décorateur `@Roles(...)`

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Utilisation sur un handler :
```typescript
@Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER')
@Post()
create(@Body() dto: CreateEmployeeDto) { ... }
```

### 4.3 Décorateur `@Permission(resource, action)`

```typescript
// permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';
export const Permission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action });
```

Utilisation :
```typescript
@Permission('employees', 'write')
@Post()
create(@Body() dto: CreateEmployeeDto) { ... }
```

### 4.4 RoleGuard

```
RoleGuard implements CanActivate:
  1. Récupère ROLES_KEY depuis les métadonnées du handler (puis du controller)
  2. Si pas de métadonnées → passe (route non protégée par rôle)
  3. Récupère req.user depuis le contexte HTTP
  4. Si req.user == null → throw UnauthorizedException
  5. Vérifie que req.user.roles contient au moins un des rôles requis
     → si non : throw ForbiddenException (403)
     → si oui : retourne true
```

### 4.5 PermissionGuard

```
PermissionGuard implements CanActivate:
  1. Récupère PERMISSION_KEY depuis les métadonnées
  2. Si pas de métadonnées → passe
  3. Récupère req.user
  4. Si req.user == null → throw UnauthorizedException
  5. Vérifie que req.user.permissions contient { resource, action } requis
     → si non : throw ForbiddenException (403)
     → si oui : retourne true
```

### 4.6 Ordre des guards

Sur chaque endpoint sensible, les guards s'appliquent dans l'ordre :

```
1. SessionGuard (vérifie que la session est valide → 401 si non)
2. RoleGuard (vérifie le rôle → 403 si absent)
3. PermissionGuard (vérifie la permission → 403 si absente)
4. Logic métier (vérification Department Manager Scope dans le service)
```

Déclaration type sur un contrôleur :

```typescript
@UseGuards(SessionGuard, RoleGuard, PermissionGuard)
@Controller('employees')
export class EmployeesController { ... }
```

### 4.7 Chargement des rôles/permissions dans le contexte

Le `SessionMiddleware` (étape 1.1) charge déjà les rôles et permissions dans `req.user` à chaque requête authentifiée. La requête Prisma inclut :

```
User.userRoles
  → UserRole.role
    → Role.rolePermissions
      → RolePermission.permission
```

Le contexte résultant est structuré pour les guards :

```typescript
req.user = {
  id: string,
  username: string,
  email: string,
  status: UserStatus,
  roles: string[],           // noms des rôles, ex: ['SUPER_ADMIN']
  permissions: Array<{resource: string, action: string}>,
  employeeIdentity: { employeeId: string, departmentId: string } | null,
}
```

Le `departmentId` de l'employé est disponible dans le contexte pour les vérifications de scope Department Manager côté service.

### 4.8 Les 3 rôles MVP 1 et leurs permissions

| Rôle | Permissions |
|------|-------------|
| `SUPER_ADMIN` | `dashboard:read`, `employees:read`, `employees:write`, `employees:delete`, `departments:read`, `departments:write` |
| `DEPARTMENT_MANAGER` | `dashboard:read`, `employees:read`, `employees:write`, `departments:read` |
| `EMPLOYEE` | `dashboard:read`, `employees:read`, `departments:read` |

Ces données sont **créées par le Seed MVP 1**, pas codées en dur dans la logique applicative.

---

## 5. Étape 1.3 — Module Dashboard

### 5.1 Structure du module DashboardModule

```
apps/backend/src/
└── dashboard/
    ├── dashboard.module.ts
    ├── dashboard.controller.ts
    ├── dashboard.service.ts
    └── dto/
        └── dashboard-response.dto.ts
```

### 5.2 Endpoint `GET /api/v1/dashboard`

**Guards :** `SessionGuard`, `RoleGuard`, `PermissionGuard`
**Rôles autorisés :** `SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`
**Permission requise :** `dashboard:read`

**`DashboardResponseDto` :**

```typescript
export class DashboardResponseDto {
  role: string;
  indicators: {
    totalEmployees?: number;       // SUPER_ADMIN et DEPARTMENT_MANAGER
    departmentEmployees?: number;  // DEPARTMENT_MANAGER uniquement (son département)
    departmentName?: string;       // DEPARTMENT_MANAGER uniquement
  };
  recentActivity: [];              // vide en MVP 1, réservé pour MVP 2
}
```

**Logique de scoping dans `DashboardService.getIndicators(user)` :**

```
Si role == 'SUPER_ADMIN':
  totalEmployees = count(employees where employmentStatus = ACTIVE)
  
Si role == 'DEPARTMENT_MANAGER':
  departmentId = user.employeeIdentity.departmentId
  departmentEmployees = count(employees where departmentId = X and employmentStatus = ACTIVE)
  departmentName = department.name
  
Si role == 'EMPLOYEE':
  Pas d'indicateurs chiffrés — retourne un DTO avec champs vides
  (les contenus personnalisés arriveront en MVP 2)
```

### 5.3 Écran `/dashboard` — Frontend

**Layout protégé (`app/(auth)/layout.tsx`) :**

Le route group `(auth)` héberge toutes les pages authentifiées. Son layout :
1. Exécute `getSession()` côté serveur.
2. Si `null` → `redirect('/login')`.
3. Sinon, rend le layout avec sidebar + topbar.

**Structure du layout :**
- Sidebar fixe 260px (desktop), avec entrées de menu filtrées par rôle.
- Topbar : nom de l'utilisateur, bascule thème, icône notifications (badge).
- Zone de contenu principale (`children`).

**Composants du dashboard (`app/(auth)/dashboard/page.tsx`) :**

- Composant serveur qui appelle `GET /api/v1/dashboard`.
- Rend des `<DashboardCard>` en grille 12 colonnes selon le rôle.

**Contenu par rôle :**

| Rôle | Cartes affichées |
|------|-----------------|
| `EMPLOYEE` | "Mes informations" (profil), "Mes documents récents" (placeholder), "Mes notifications" (placeholder) |
| `DEPARTMENT_MANAGER` | "Effectif de mon équipe" (chiffre réel), "Indicateurs du département" (nom département), "Documents en attente" (placeholder) |
| `SUPER_ADMIN` | "Effectif global" (chiffre réel), "Activité récente" (vide en MVP 1), "Accès rapides" (liens vers modules) |

**`DashboardCard` :** fond `--color-background-surface`, bordure `--color-border`, `border-radius: 8px`, ombre `0 1px 3px rgba(0,0,0,0.06)`. Chaque carte a un label, une valeur principale (Inter 600 28–36px pour les chiffres), et un sous-label contextuel.

**États à prévoir :**
- Chargement : skeleton qui mime la forme des cartes (pas de spinner générique).
- Erreur : message "Impossible de charger le tableau de bord. Réessayer." + bouton de retry.

---

## 6. Étape 1.4 — Module Employés

### 6.1 Structure du module EmployeesModule

```
apps/backend/src/
└── employees/
    ├── employees.module.ts
    ├── employees.controller.ts
    ├── employees.service.ts
    └── dto/
        ├── create-employee.dto.ts
        ├── update-employee.dto.ts
        ├── employee-response.dto.ts
        └── pagination-query.dto.ts
```

### 6.2 DTOs

**`PaginationQueryDto` :**

```typescript
export class PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;
}
```

**`CreateEmployeeDto` :**

```typescript
export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  professionalEmail: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsUUID()
  departmentId: string;

  @IsUUID()
  positionId: string;

  @IsOptional()
  @IsUUID()
  managerId?: string;

  @IsDateString()
  hireDate: string;
}
```

**`UpdateEmployeeDto` :** PartialType de `CreateEmployeeDto` (tous les champs optionnels via `@nestjs/mapped-types`).

**`EmployeeResponseDto` :**

```typescript
export class EmployeeResponseDto {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  professionalEmail: string;
  phone: string | null;
  departmentId: string;
  department: { id: string; name: string; code: string };
  positionId: string;
  position: { id: string; title: string };
  managerId: string | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}
```

### 6.3 Endpoints et guards

| Méthode | Path | RoleGuard | PermissionGuard | Service scope |
|---------|------|-----------|-----------------|---------------|
| GET | `/api/v1/employees` | SUPER_ADMIN, DEPARTMENT_MANAGER, EMPLOYEE | `employees:read` | Tous les employés actifs (paginés) |
| GET | `/api/v1/employees/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER, EMPLOYEE | `employees:read` | Employé unique |
| POST | `/api/v1/employees` | SUPER_ADMIN, DEPARTMENT_MANAGER | `employees:write` | Vérification dept scope si DEPT_MGR |
| PATCH | `/api/v1/employees/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER | `employees:write` | Vérification dept scope si DEPT_MGR |

**Génération du `employeeNumber` :**

```
Format : GF-{AAAA}-{NNN padded 3 digits}
Exemple : GF-2026-007
Logique : count(employees) + 1, formaté en 3 chiffres
```

Le service génère ce numéro de façon déterministe au moment de la création.

### 6.4 Vérification Department Manager Scope (service layer)

Pour `POST` et `PATCH`, après les guards de rôle/permission, le service applique :

```
Si user.roles inclut 'DEPARTMENT_MANAGER':
  managerDeptId = user.employeeIdentity.departmentId
  
  Pour POST:
    Si dto.departmentId != managerDeptId → throw ForbiddenException (403)
  
  Pour PATCH:
    Charger l'employé existant
    Si employee.departmentId != managerDeptId → throw ForbiddenException (403)
    Si dto.departmentId et dto.departmentId != managerDeptId → throw ForbiddenException (403)
```

### 6.5 Écrans frontend

**`/employees` (liste) :**
- Composant client pour la pagination et les filtres interactifs.
- Tableau shadcn/ui customisé GFEP : en-têtes sticky, hauteur de ligne 40px, fond de survol `--color-background-main`.
- Colonnes : nom complet, département, poste, statut (badge sémantique), date d'embauche.
- Filtres au-dessus du tableau : recherche texte (nom), sélecteur département, sélecteur statut.
- Pagination en bas : numéros de pages, taille de page.
- Clic sur une ligne → navigation vers `/employees/:id`.
- Bouton "Nouvel employé" (primaire) visible uniquement pour `SUPER_ADMIN` et `DEPARTMENT_MANAGER`.
- États : skeleton (5 lignes fantômes), vide ("Aucun employé trouvé"), erreur (message + retry).

**`/employees/:id` (détail) :**
- En-tête : nom complet, badge statut, boutons "Modifier" et "Suspendre" (visibles selon rôle).
- Section informations personnelles : email, téléphone.
- Section informations professionnelles : département (lien), poste, responsable (lien vers son profil), date d'embauche.
- Fil d'Ariane : Employés > Prénom Nom.

**`/employees/new` et `/employees/:id/edit` (formulaires) :**
- React Hook Form + Zod côté client.
- Labels visibles au-dessus de chaque champ.
- Sélecteurs pour département, poste, responsable (fetch des listes depuis l'API).
- Validation en temps réel après la première soumission tentée.
- Messages d'erreur sous le champ concerné, couleur `--color-error`.
- Boutons : "Enregistrer" (primaire) + "Annuler" (secondaire).

### 6.6 Intégration dans AppModule

```typescript
// AppModule imports
AuthModule,
RbacModule,
DashboardModule,
EmployeesModule,
```

---

## 7. Étape 1.5 — Module Départements

### 7.1 Structure du module DepartmentsModule

```
apps/backend/src/
└── departments/
    ├── departments.module.ts
    ├── departments.controller.ts
    ├── departments.service.ts
    └── dto/
        └── department-response.dto.ts
```

### 7.2 DTOs

**`DepartmentResponseDto` :**

```typescript
export class DepartmentResponseDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  headcount: number;           // calculé dynamiquement, non stocké
  manager: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
  } | null;
  createdAt: string;
}
```

**`DepartmentDetailResponseDto` (étend `DepartmentResponseDto`) :**

```typescript
export class DepartmentDetailResponseDto extends DepartmentResponseDto {
  employees: Array<{
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    position: string;
    employmentStatus: EmploymentStatus;
  }>;
}
```

### 7.3 Endpoints et guards

| Méthode | Path | RoleGuard | PermissionGuard | Logique |
|---------|------|-----------|-----------------|---------|
| GET | `/api/v1/departments` | SUPER_ADMIN, DEPARTMENT_MANAGER, EMPLOYEE | `departments:read` | Liste des 6 départements avec effectif |
| GET | `/api/v1/departments/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER, EMPLOYEE | `departments:read` | Détail + liste des employés rattachés |

**Calcul de l'effectif (`DepartmentsService`) :**

```
headcount = count(employees WHERE departmentId = X AND employmentStatus = 'ACTIVE')
```

Ce count est effectué par Prisma via `_count` dans la même requête que le département (pas de requête séparée) :

```prisma
findUnique({
  where: { id },
  include: {
    manager: { include: { position: true } },
    _count: { select: { employees: { where: { employmentStatus: 'ACTIVE' } } } },
    employees: { where: { employmentStatus: 'ACTIVE' }, include: { position: true } },
  },
})
```

### 7.4 Écrans frontend

**`/departments` (liste) :**
- 6 cartes en grille (3 colonnes desktop, 2 tablette, 1 mobile).
- Chaque carte affiche : nom du département, code, effectif réel (chiffre en gras Inter 600), nom du responsable.
- Icône Lucide pertinente par département (ex: `Building2` pour Direction, `Users` pour RH).
- Clic sur une carte → navigation vers `/departments/:id`.
- États : skeleton (6 cartes fantômes), erreur.

**`/departments/:id` (détail) :**
- En-tête : nom du département, code, effectif.
- Section "Responsable" : nom, poste.
- Section "Équipe" : tableau des employés du département (nom, poste, statut).
- Fil d'Ariane : Départements > Nom du département.
- États : skeleton, erreur.

---

## 8. Seed MVP 1

### 8.1 Emplacement et commande d'exécution

```
apps/backend/prisma/seed-mvp1.ts
```

Configuré dans `package.json` du backend :

```json
"prisma": {
  "seed": "tsx prisma/seed-mvp1.ts"
}
```

Exécution : `npx prisma db seed` depuis `apps/backend/`.

### 8.2 Ordre de création des données

Les dépendances de clés étrangères imposent l'ordre suivant :

```
1. departments (6)
2. positions (~6, au moins 1 par département)
3. employees (~5, avec managerId null pour les premiers créés)
4. mise à jour du managerId pour les relations hiérarchiques
5. mise à jour du Department.managerId (désignation des responsables)
6. roles (3 : SUPER_ADMIN, DEPARTMENT_MANAGER, EMPLOYEE)
7. permissions (9 : 3 ressources × 3 actions au minimum)
8. role_permissions (liens rôle ↔ permission)
9. users (3, un par rôle, argon2-hashé, authProvider = LOCAL)
10. employee_identities (3, liant users et employees)
11. user_roles (3, liant users et roles)
```

### 8.3 Volumétrie et structure

**6 départements :**

| code | name |
|------|------|
| DG | Direction générale |
| RH | Ressources humaines |
| CF | Comptabilité et finances |
| IT | Informatique |
| CO | Commercial |
| AC | Audit et conformité |

**~6 postes (un par département) :**

| title | department | hierarchyLevel |
|-------|------------|----------------|
| Directeur général | DG | 1 |
| Responsable RH | RH | 2 |
| Responsable comptable | CF | 2 |
| Responsable informatique | IT | 2 |
| Responsable commercial | CO | 2 |
| Responsable audit | AC | 2 |

**~5 employés :**

| employeeNumber | firstName | lastName | department | position | role |
|----------------|-----------|----------|------------|----------|------|
| GF-2026-001 | Fatoumata | Camara | RH | Responsable RH | DEPARTMENT_MANAGER |
| GF-2026-002 | Mamadou | Diallo | CF | Responsable comptable | EMPLOYEE |
| GF-2026-003 | Ibrahim | Sow | IT | Responsable informatique | EMPLOYEE |
| GF-2026-004 | Mohamed | Keïta | DG | Directeur général | SUPER_ADMIN |
| GF-2026-005 | Aïssatou | Barry | AC | Responsable audit | EMPLOYEE |

**3 utilisateurs (comptes locaux, mot de passe hashé argon2) :**

| username | email | role | password (clair — seed uniquement) |
|----------|-------|------|-------------------------------------|
| m.keita | m.keita@guineasf.com | SUPER_ADMIN | GF_Admin2026! |
| f.camara | f.camara@guineasf.com | DEPARTMENT_MANAGER | GF_Mgr2026! |
| m.diallo | m.diallo@guineasf.com | EMPLOYEE | GF_Emp2026! |

**Important :** les mots de passe en clair ne sont jamais stockés ni loggés — uniquement le hash argon2.

**9 permissions minimum :**

| resource | action | description |
|----------|--------|-------------|
| dashboard | read | Accéder au tableau de bord |
| employees | read | Consulter la liste et les fiches employés |
| employees | write | Créer et modifier des employés |
| employees | delete | Supprimer des employés (SUPER_ADMIN uniquement) |
| departments | read | Consulter la liste et le détail des départements |
| departments | write | Modifier les informations d'un département |

**Associations rôle ↔ permission :**

| role | permissions |
|------|-------------|
| SUPER_ADMIN | Toutes les permissions ci-dessus |
| DEPARTMENT_MANAGER | dashboard:read, employees:read, employees:write, departments:read |
| EMPLOYEE | dashboard:read, employees:read, departments:read |

### 8.4 Idempotence du seed

Le script utilise `upsert` ou vérifie l'existence avant insertion pour être idempotent : une deuxième exécution ne crée pas de doublons.

---

## 9. Schéma de données (tables concernées)

Le `schema.prisma` actuel dans `apps/backend/prisma/schema.prisma` correspond **exactement** au schéma défini dans `05-Backend-Schema.md` section 3. Aucune modification du schéma n'est requise pour ce lot.

Tables utilisées par les modules de ce lot :

| Table | Module |
|-------|--------|
| `users` | Auth, RBAC, Seed |
| `sessions` | Auth |
| `auth_events` | Auth |
| `employee_identities` | Auth, Seed |
| `roles` | RBAC, Seed |
| `permissions` | RBAC, Seed |
| `user_roles` | RBAC, Seed |
| `role_permissions` | RBAC, Seed |
| `employees` | Employés, Départements, Dashboard |
| `departments` | Départements, Employees, Dashboard |
| `positions` | Employés, Seed |

Tables définies dans le schéma mais hors périmètre de ce lot (tables présentes, non utilisées activement) : `documents`, `document_categories`, `document_permissions`, `transactions`, `invoices`, `notifications`, `audit_logs`, `security_events`, `lab_scenarios`, `scenario_executions`, `ad_group_role_mapping`.

**Observation sur le schéma existant :** le `schema.prisma` actuellement en base est conforme à `05-Backend-Schema.md`. Aucune anomalie technique n'a été détectée. Le champ `AuthEvent.authenticationMethod` est de type `AuthProvider` (enum `LOCAL | ACTIVE_DIRECTORY`), ce qui est cohérent avec le flux d'authentification.

---

## 10. Gestion des erreurs

### 10.1 Format de réponse d'erreur standardisé

Toutes les erreurs suivent le format NestJS par défaut enrichi :

```json
{
  "statusCode": 401,
  "message": "Identifiants invalides.",
  "error": "Unauthorized"
}
```

Les détails techniques (stack trace, raison précise) sont loggés côté serveur uniquement — jamais dans la réponse client.

### 10.2 Règle du message générique d'authentification

En cas d'échec de connexion, quelle que soit la cause (compte inexistant, mauvais mot de passe, compte verrouillé), la réponse est toujours :

```json
{
  "statusCode": 401,
  "message": "Identifiants invalides."
}
```

Cette règle est absolue et ne comporte aucune exception dans le périmètre de ce lot.

### 10.3 Codes HTTP utilisés

| Situation | HTTP |
|-----------|------|
| Succès | 200 / 201 / 204 |
| Validation DTO échouée | 400 |
| Session invalide / expirée | 401 |
| Rôle / permission manquante | 403 |
| Ressource non trouvée | 404 |
| Rate limit dépassé | 429 |
| Erreur serveur | 500 |

### 10.4 États frontend (chaque écran de liste ou détail)

- **Chargement** : skeleton respectant la forme du contenu final (pas de spinner isolé centré).
- **Vide** : icône Lucide sobre + message contextuel + action suggérée si pertinente.
- **Erreur** : message "Impossible de charger les données." + bouton "Réessayer".
- **Accès refusé (403)** : message "Vous n'avez pas accès à cette section." — distinct de 404.
- **Ressource introuvable (404)** : message "Cette ressource n'existe pas ou a été supprimée."

---

## 11. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1 : DTO validation rejects extra fields

*For any* request body sent to a protected endpoint containing fields not declared in the corresponding DTO, the backend SHALL reject the request with HTTP 400, and the response body SHALL NOT echo back the extra fields.

**Validates: Requirements 9.4, 18.5**

---

### Property 2 : Password hashing round-trip

*For any* non-empty password string, hashing it with argon2 and then verifying the original string against the resulting hash SHALL return true. For any two distinct strings A and B, verifying B against hash(A) SHALL return false.

**Validates: Requirements 10.1**

---

### Property 3 : Session token is never stored in plaintext

*For any* successful login, the value stored in `sessions.sessionTokenHash` SHALL differ from the raw session token transmitted in the cookie, and the stored value SHALL be a deterministic hash of the raw token (SHA-256).

**Validates: Requirements 11.2**

---

### Property 4 : Session validation round-trip

*For any* active, non-expired, non-revoked session, hashing the raw session token from the cookie and looking up the resulting hash in the `sessions` table SHALL return the corresponding session. For any expired or revoked session, the same lookup SHALL be rejected with HTTP 401.

**Validates: Requirements 11.4**

---

### Property 5 : RBAC access control invariant

*For any* authenticated user and protected endpoint, access is granted if and only if the user's roles include at least one role declared on the handler AND the user's permissions include the permission declared on the handler. If either condition fails, the backend SHALL return HTTP 403.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4**

---

### Property 6 : Department Manager Scope write restriction

*For any* employee resource whose `departmentId` does not match the `departmentId` of the authenticated `DEPARTMENT_MANAGER`, a write operation (POST or PATCH) SHALL be rejected with HTTP 403.

**Validates: Requirements 19.3, 19.4**

---

### Property 7 : Employee list pagination invariant

*For any* valid combination of `page` and `limit` query parameters, the paginated employee list SHALL return at most `limit` items, and the offset applied SHALL equal `(page - 1) * limit`.

**Validates: Requirements 18.1**

---

### Property 8 : Department headcount is always live

*For any* department, the `headcount` field returned by `GET /api/v1/departments` or `GET /api/v1/departments/:id` SHALL equal the count of employees in the `employees` table where `departmentId` matches the department and `employmentStatus = 'ACTIVE'`. This property holds after any employee creation, update, or status change.

**Validates: Requirements 21.3**
