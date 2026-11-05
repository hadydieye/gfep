# Plan d'implémentation — Lot 0 (nettoyage) + MVP 1 (étapes 1.1 à 1.5)
## Guinea Finance Enterprise Portal (GFEP)

---

## Vue d'ensemble

Ce plan couvre le nettoyage de la fondation (Lot 0) puis les cinq étapes fonctionnelles du MVP 1 : authentification locale, RBAC, dashboard, module employés et module départements. Chaque tâche est traçable vers les exigences de `requirements.md`. Les sous-tâches marquées `*` sont optionnelles (tests) et peuvent être différées pour un MVP rapide.

---

## Tâches

### Lot 0 — Nettoyage de la fondation

- [x] T0.1 — Supprimer le code mort du backend
  - [x] T0.1.1 Supprimer `apps/backend/src/app.controller.ts`
    - Vérifier qu'aucun autre fichier n'importe ce contrôleur avant suppression
    - _→ Req 1_
  - [x] T0.1.2 Supprimer `apps/backend/src/app.service.ts`
    - Vérifier qu'aucun autre fichier n'importe ce service avant suppression
    - _→ Req 1_
  - [x] T0.1.3 Supprimer `apps/backend/src/app.controller.spec.ts`
    - _→ Req 1_
  - [x] T0.1.4 Nettoyer `apps/backend/src/app.module.ts`
    - Retirer les imports de `AppController` et `AppService` s'ils sont encore présents
    - État cible : `AppModule` importe uniquement `ConfigModule.forRoot({ isGlobal: true })`, `PrismaModule`, `HealthModule`
    - _→ Req 1.3_
  - [x] T0.1.5 Lancer `npm run build` dans `apps/backend` et vérifier l'absence d'erreur de compilation liée aux fichiers supprimés
    - _→ Req 1.2_

- [x] T0.2 — Consolidation des linters (backend)
  - [x] T0.2.1 Supprimer `apps/backend/.eslintrc.js`
    - _→ Req 2.1_
  - [x] T0.2.2 Retirer `eslint`, `@typescript-eslint/eslint-plugin` et `@typescript-eslint/parser` des `devDependencies` de `apps/backend/package.json`
    - Ces trois paquets sont listés dans le `package.json` actuel et sont sans objet avec oxlint
    - Conserver : `oxlint`, `oxlint-tsgolint`
    - _→ Req 2.2_
  - [x] T0.2.3 Lancer `npm run lint` depuis la racine du monorepo et vérifier l'absence d'erreur de configuration
    - _→ Req 2.4_

- [x] T0.3 — Vérifier la source unique des tokens Tailwind v4
  - [x] T0.3.1 Ouvrir `apps/frontend/src/app/globals.css` et confirmer que le bloc `@theme` est présent et contient tous les tokens GFEP (palette, espacement, typographie, radius)
    - Ne modifier le fichier que si un token documenté dans `04-UXUI-Design-System.md` est absent
    - _→ Req 3.1_
  - [x] T0.3.2 Confirmer qu'il n'y a pas de directive `@config` dans `globals.css`
    - Si une directive `@config` est présente, la supprimer
    - _→ Req 3.2_
  - [x] T0.3.3 Si `tailwind.config.ts` existe dans `apps/frontend`, y ajouter un commentaire en tête indiquant qu'il s'agit d'une référence documentaire uniquement et qu'il n'est pas lu par Tailwind v4
    - _→ Req 3.3_

- [x] T0.4 — Aligner la version Node
  - [x] T0.4.1 Lire `.nvmrc` à la racine du monorepo et noter la version déclarée (actuellement `22`)
    - _→ Req 4.1_
  - [x] T0.4.2 Vérifier que le champ `engines.node` du `package.json` racine est présent et correspond à `>=22`
    - L'ajouter ou le corriger s'il est absent ou divergent
    - _→ Req 4.2_

- [x] T0.5 — Configurer les rewrites Next.js
  - [x] T0.5.1 Modifier `apps/frontend/next.config.ts` pour ajouter la règle de rewrite `/api/v1/:path*` → `${backendUrl}/api/v1/:path*`
    - La variable `backendUrl` est lue depuis `process.env.NEXT_PUBLIC_BACKEND_URL` avec fallback `http://localhost:3001`
    - Ne pas coder l'URL en dur dans `next.config.ts`
    - _→ Req 5.1, 5.2_
  - [x] T0.5.2 Créer ou mettre à jour `apps/frontend/.env.local` avec la variable `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`
    - S'assurer que `.env.local` est dans `.gitignore` du frontend
    - _→ Req 5.3_
  - [x] T0.5.3 Vérifier manuellement qu'une requête vers `/api/v1/health` est bien proxiée vers le backend (HTTP 200)
    - _→ Req 5.4_

- [x] T0.6 — Installer lucide-react
  - [x] T0.6.1 Ajouter `lucide-react` aux `dependencies` de `apps/frontend/package.json` avec une version caret-bounded (ex: `^0.511.0`)
    - Exécuter `npm install lucide-react` dans `apps/frontend` (ou équivalent selon le gestionnaire de paquets du monorepo)
    - _→ Req 6.1_

- [x] T0.7 — Déplacer prisma en devDependencies et nettoyer docker-compose
  - [x] T0.7.1 Dans `apps/backend/package.json`, déplacer `"prisma": "^5.22.0"` de `dependencies` vers `devDependencies`
    - `@prisma/client` reste en `dependencies` (dépendance runtime)
    - _→ Req 7.1_
  - [x] T0.7.2 Ouvrir `docker-compose.yml` à la racine du monorepo et supprimer le champ `version:` s'il est présent
    - _→ Req 7.2_

- [x] T0.8 — Rediriger la page d'accueil `/` vers `/dashboard` ou `/login`
  - [x] T0.8.1 Remplacer le contenu de `apps/frontend/src/app/page.tsx` par un composant serveur asynchrone qui :
    - Appelle `getSession()` (helper à créer à T1.1.9)
    - Redirige vers `/dashboard` si une session est active, sinon vers `/login`
    - Note : créer une version simplifiée pour l'instant (redirect vers `/login` systématiquement) ; elle sera enrichie une fois `getSession()` implémenté à T1.1.9
    - _→ Req 8.1, 8.2, 8.3_

- [x] T0.9 — Vérifier DECISIONS.md
  - [x] T0.9.1 Lire `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md` et confirmer que les décisions C1–C4 et D1–D10 sont documentées
    - Ajouter toute décision manquante si l'implémentation du Lot 0 révèle un choix non encore documenté
    - _→ Req 1 à 8 (traçabilité des décisions)_

---

### Étape 1.1 — Authentification locale

- [x] T1.1.1 — Créer la structure de fichiers du module AuthModule
  - [x] T1.1.1.1 Créer le répertoire `apps/backend/src/auth/` avec les fichiers vides suivants :
    - `auth.module.ts`
    - `auth.controller.ts`
    - `auth.service.ts`
    - `session.middleware.ts`
    - `session.guard.ts`
    - `dto/login.dto.ts`
    - `dto/auth-response.dto.ts`
    - `decorators/current-user.decorator.ts`
  - [x] T1.1.1.2 Installer les dépendances manquantes dans `apps/backend` : `@nestjs/throttler`, `argon2`, `class-validator`, `class-transformer`, `@nestjs/mapped-types`
    - Vérifier quelles dépendances sont déjà présentes dans `package.json` avant d'installer
    - _→ Req 9, 10, 12_

- [x] T1.1.2 — Implémenter SessionMiddleware et SessionGuard
  - [x] T1.1.2.1 Implémenter `session.middleware.ts` :
    - Lire le cookie dont le nom est `process.env.SESSION_COOKIE_NAME`
    - Si absent, poser `req.user = null` et appeler `next()`
    - Calculer le SHA-256 du token reçu avec `crypto.createHash('sha256')`
    - Interroger Prisma : `findUnique` sur `sessions` par `sessionTokenHash`, avec `include` sur `user → userRoles → role → rolePermissions → permission` et `user → employeeIdentity`
    - Si la session est introuvable, révoquée (`revokedAt != null`) ou expirée (`expiresAt < now()`) : poser `req.user = null`
    - Sinon, construire et poser l'objet `req.user` : `{ id, username, email, status, roles: string[], permissions: {resource, action}[], employeeIdentity: {employeeId, departmentId} | null }`
    - Appeler `next()` dans tous les cas
    - _→ Req 11.4, 11.6_
  - [x] T1.1.2.2 Implémenter `session.guard.ts` :
    - `SessionGuard implements CanActivate`
    - Si `req.user == null` → throw `UnauthorizedException`
    - Sinon retourner `true`
    - _→ Req 11.4_
  - [x] T1.1.2.3 Implémenter le décorateur `@CurrentUser()` dans `decorators/current-user.decorator.ts` :
    - Utiliser `createParamDecorator` pour extraire `request.user` du contexte HTTP
    - _→ Req 11.6_

- [x] T1.1.3 — Implémenter LoginDto et AuthResponseDto avec class-validator
  - [x] T1.1.3.1 Implémenter `dto/login.dto.ts` :
    - Champ `username` : `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)`
    - Champ `password` : `@IsString()`, `@IsNotEmpty()`, `@MaxLength(200)`
    - _→ Req 9.1, 9.4_
  - [x] T1.1.3.2 Implémenter `dto/auth-response.dto.ts` :
    - Champs : `id`, `username`, `email`, `status`, `roles: RoleDto[]`, `permissions: PermissionDto[]`, `employee: { id, firstName, lastName, departmentId } | null`
    - _→ Req 9.3, 11.6_
  - [x] T1.1.3.3 Activer le `ValidationPipe` global dans `apps/backend/src/main.ts` :
    - `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
    - Vérifier que `reflect-metadata` est importé en tête de `main.ts`
    - _→ Req 9.4_

- [x] T1.1.4 — Implémenter le service AuthService (login, logout, me)
  - [x] T1.1.4.1 Implémenter `AuthService.login(dto, req)` dans `auth.service.ts` :
    - Rechercher le `User` par `username` via Prisma
    - Si l'utilisateur n'existe pas OU `status == LOCKED` : créer un `AuthEvent(LOGIN_FAILED)` si trouvé, retourner une `UnauthorizedException` avec le message générique `"Identifiants invalides."`
    - Vérifier le mot de passe avec `argon2.verify(user.passwordHash, dto.password)`
    - Si vérification échoue : incrémenter `failedLoginCount`, si `failedLoginCount >= 5` → passer `status` à `LOCKED` + créer `AuthEvent(ACCOUNT_LOCKED)`, créer `AuthEvent(LOGIN_FAILED)`, retourner `UnauthorizedException` message générique
    - Si vérification réussit : remettre `failedLoginCount = 0`, mettre à jour `lastLoginAt`, générer `sessionToken = crypto.randomBytes(48).toString('hex')`, calculer `sessionTokenHash = SHA-256(sessionToken)`, créer `Session { sessionTokenHash, ipAddress: req.ip, userAgent: req.headers['user-agent'], expiresAt: now + 8h }`, créer `AuthEvent(LOGIN_SUCCESS)`, poser le cookie httpOnly avec `sessionToken`, retourner `AuthResponseDto`
    - Note : argon2 pour les mots de passe, SHA-256 pour le token de session (deux mécanismes distincts)
    - _→ Req 9.1, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3_
  - [x] T1.1.4.2 Implémenter `AuthService.logout(sessionId, res)` :
    - Mettre à jour `Session.revokedAt = now()`
    - Créer `AuthEvent(LOGOUT)`
    - Effacer le cookie (Set-Cookie avec `Max-Age=0`)
    - _→ Req 9.2, 11.5_
  - [x] T1.1.4.3 Implémenter `AuthService.me(user)` :
    - Recharger le `User` complet depuis Prisma (rôles + permissions + employeeIdentity)
    - Retourner `AuthResponseDto`
    - _→ Req 9.3_

- [x] T1.1.5 — Configurer le rate limiting sur POST /auth/login
  - [x] T1.1.5.1 Installer `@nestjs/throttler` (si pas déjà fait à T1.1.1.2)
    - _→ Req 12_
  - [x] T1.1.5.2 Enregistrer `ThrottlerModule.forRoot([{ name: 'login', ttl: 900000, limit: 5 }])` dans `AppModule`
    - TTL en millisecondes : 15 minutes = 900 000 ms
    - _→ Req 12.1_
  - [x] T1.1.5.3 Appliquer `@UseGuards(ThrottlerGuard)` et `@Throttle({ login: { limit: 5, ttl: 900000 } })` sur le handler `POST /auth/login` uniquement
    - La réponse en cas de dépassement doit retourner HTTP 429
    - _→ Req 12.1, 12.2_

- [x] T1.1.6 — Implémenter AuthController (login, logout, me)
  - [x] T1.1.6.1 Implémenter le handler `POST /auth/login` dans `auth.controller.ts` :
    - Décorateurs : `@Post('login')`, `@UseGuards(ThrottlerGuard)`, `@Throttle({ login: { limit: 5, ttl: 900000 } })`
    - Corps validé par `LoginDto`
    - Délègue à `AuthService.login(dto, req)`
    - _→ Req 9.1, 12_
  - [x] T1.1.6.2 Implémenter le handler `POST /auth/logout` :
    - Décorateurs : `@Post('logout')`, `@UseGuards(SessionGuard)`
    - Délègue à `AuthService.logout()`
    - Retourne HTTP 204
    - _→ Req 9.2_
  - [x] T1.1.6.3 Implémenter le handler `GET /auth/me` :
    - Décorateurs : `@Get('me')`, `@UseGuards(SessionGuard)`
    - Utilise `@CurrentUser()` pour passer l'utilisateur au service
    - Délègue à `AuthService.me(user)`
    - _→ Req 9.3_
  - [x] T1.1.6.4 Déclarer `AuthModule` et l'enregistrer dans `AppModule` :
    - `AuthModule` importe `PrismaModule`
    - `AuthModule` exporte `AuthService`
    - Enregistrer `SessionMiddleware` via `AppModule.configure(consumer)` : appliqué sur `'*'`, exclu de `POST /api/v1/auth/login`
    - Ajouter `AuthModule` dans les `imports` de `AppModule`
    - _→ Req 9_

- [x] T1.1.7 — Créer l'écran /login frontend (LoginForm)
  - [x] T1.1.7.1 Créer le répertoire `apps/frontend/src/app/login/` et le fichier `page.tsx` (page serveur)
    - Layout centré verticalement (100vh), fond `--color-background-main`
    - Carte centrale : fond `--color-background-surface`, bordure `--color-border`, `border-radius: 8px`, ombre `0 1px 3px rgba(0,0,0,0.06)`
    - Contenu : logo textuel "GUINEA FINANCE" (Inter 600, `--color-primary`), sous-titre "Portail de gestion interne" (texte secondaire), composant `<LoginForm />`, lien "Se connecter avec le compte d'entreprise" → `/login/ad`
    - _→ Req 13.1, 13.6_
  - [x] T1.1.7.2 Créer `apps/frontend/src/components/auth/login-form.tsx` (composant client) :
    - Installer `react-hook-form`, `zod` et `@hookform/resolvers` dans `apps/frontend`
    - Schéma Zod : `username` non vide, `password` non vide
    - Champs : deux `<Input>` shadcn/ui GFEP avec label visible au-dessus (jamais uniquement placeholder)
    - Bouton primaire "Se connecter" : couleur `--color-primary`, texte blanc
    - État soumission : spinner Lucide `Loader2` + texte "Connexion en cours..."
    - Soumission : `fetch('/api/v1/auth/login', { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify(dto) })`
    - Erreur : message sous le formulaire, couleur `--color-error`, sans révéler l'existence du compte
    - Succès : `router.push('/dashboard')`
    - _→ Req 13.1, 13.2, 13.3, 13.4, 13.6_

- [x] T1.1.8 — Créer la page /login/ad
  - [x] T1.1.8.1 Créer `apps/frontend/src/app/login/ad/page.tsx` :
    - Afficher le message : "L'authentification par compte d'entreprise n'est pas disponible pour le moment. Utilisez votre compte local ou contactez l'administrateur."
    - Bouton "Retour à la connexion locale" qui navigue vers `/login`
    - Pas de formulaire, pas d'appel API
    - Respecter le design GFEP (même fond, même carte que `/login`)
    - _→ Req 13.7_

- [x] T1.1.9 — Implémenter le helper getSession() côté serveur
  - [x] T1.1.9.1 Créer `apps/frontend/src/lib/auth/session.ts` :
    - Fonction `getSession()` asynchrone (Server Component uniquement)
    - Lire le cookie de session avec `cookies()` de `next/headers`
    - Si absent, retourner `null`
    - Appeler `GET /api/v1/auth/me` en transmettant le cookie dans les headers (`Cookie: <nom>=<valeur>`)
    - Si la réponse est 401 ou l'appel échoue, retourner `null`
    - Retourner le profil utilisateur (`AuthResponseDto`)
    - _→ Req 13.5_
  - [x] T1.1.9.2 Mettre à jour `apps/frontend/src/app/page.tsx` pour utiliser `getSession()` :
    - Si `session` → `redirect('/dashboard')`
    - Sinon → `redirect('/login')`
    - _→ Req 8.1, 8.2_

- [ ] T1.1.10 — Checkpoint 1.1 (validation manuelle utilisateur en attente)
  - Vérifier que le backend compile sans erreur, que `POST /auth/login` retourne 200 avec un cookie httpOnly, que `POST /auth/login` avec mauvais mot de passe retourne 401 avec le message générique, et que `GET /auth/me` retourne 401 sans cookie valide.
  - Demander au développeur de valider manuellement avant de passer à l'étape suivante.

---

### Étape 1.2 — RBAC basique

- [x] T1.2.1 — Créer la structure de fichiers du module RbacModule
  - [x] T1.2.1.1 Créer le répertoire `apps/backend/src/rbac/` avec les fichiers vides suivants :
    - `rbac.module.ts`
    - `guards/roles.guard.ts`
    - `guards/permission.guard.ts`
    - `decorators/roles.decorator.ts`
    - `decorators/permission.decorator.ts`
    - _→ Req 14, 15_

- [x] T1.2.2 — Implémenter les décorateurs @Roles() et @Permission()
  - [x] T1.2.2.1 Implémenter `decorators/roles.decorator.ts` :
    - `export const ROLES_KEY = 'roles'`
    - `export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)`
    - _→ Req 15.1_
  - [x] T1.2.2.2 Implémenter `decorators/permission.decorator.ts` :
    - `export const PERMISSION_KEY = 'permission'`
    - `export const Permission = (resource: string, action: string) => SetMetadata(PERMISSION_KEY, { resource, action })`
    - _→ Req 15.2_

- [x] T1.2.3 — Implémenter RoleGuard
  - [x] T1.2.3.1 Implémenter `guards/roles.guard.ts` :
    - `RoleGuard implements CanActivate`
    - Récupérer `ROLES_KEY` depuis les métadonnées du handler (puis du controller) via `Reflector`
    - Si pas de métadonnées → retourner `true` (route non protégée par rôle)
    - Récupérer `req.user` depuis le contexte HTTP
    - Si `req.user == null` → throw `UnauthorizedException`
    - Vérifier que `req.user.roles` contient au moins un des rôles requis
    - Si non → throw `ForbiddenException` ; si oui → retourner `true`
    - _→ Req 15.1, 15.3_

- [x] T1.2.4 — Implémenter PermissionGuard
  - [x] T1.2.4.1 Implémenter `guards/permission.guard.ts` :
    - `PermissionGuard implements CanActivate`
    - Récupérer `PERMISSION_KEY` depuis les métadonnées
    - Si pas de métadonnées → retourner `true`
    - Récupérer `req.user`
    - Si `req.user == null` → throw `UnauthorizedException`
    - Vérifier que `req.user.permissions` contient `{ resource, action }` requis
    - Si non → throw `ForbiddenException` ; si oui → retourner `true`
    - _→ Req 15.2, 15.3_

- [x] T1.2.5 — Intégrer RbacModule dans AppModule
  - [x] T1.2.5.1 Déclarer `RbacModule` avec le décorateur `@Global()` dans `rbac.module.ts`
    - Exporter `RoleGuard` et `PermissionGuard`
    - _→ Req 15.4_
  - [x] T1.2.5.2 Ajouter `RbacModule` dans les `imports` de `AppModule`
    - _→ Req 15.4_

---

### Étape 1.3 — Module Dashboard

- [x] T1.3.1 — Créer la structure de fichiers du module DashboardModule
  - [x] T1.3.1.1 Créer le répertoire `apps/backend/src/dashboard/` avec les fichiers vides suivants :
    - `dashboard.module.ts`
    - `dashboard.controller.ts`
    - `dashboard.service.ts`
    - `dto/dashboard-response.dto.ts`
    - _→ Req 16_

- [x] T1.3.2 — Implémenter GET /api/v1/dashboard avec scoping par rôle
  - [x] T1.3.2.1 Implémenter `dto/dashboard-response.dto.ts` :
    - Champs : `role: string`, `indicators: { totalEmployees?: number, departmentEmployees?: number, departmentName?: string }`, `recentActivity: []`
    - _→ Req 16.1, 16.2_
  - [x] T1.3.2.2 Implémenter `DashboardService.getIndicators(user)` dans `dashboard.service.ts` :
    - Si `role == 'SUPER_ADMIN'` : `totalEmployees = count(employees WHERE employmentStatus = ACTIVE)`
    - Si `role == 'DEPARTMENT_MANAGER'` : `departmentId = user.employeeIdentity.departmentId`, `departmentEmployees = count(employees WHERE departmentId = X AND employmentStatus = ACTIVE)`, `departmentName = department.name`
    - Si `role == 'EMPLOYEE'` : retourner un DTO avec `indicators` vide
    - Toutes les requêtes via Prisma, pas de SQL brut
    - _→ Req 16.2, 16.3_
  - [x] T1.3.2.3 Implémenter `DashboardController` dans `dashboard.controller.ts` :
    - Décorateurs sur le contrôleur : `@UseGuards(SessionGuard, RoleGuard, PermissionGuard)`, `@Controller('dashboard')`
    - Handler `GET /` : `@Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')`, `@Permission('dashboard', 'read')`
    - Utilise `@CurrentUser()` pour passer l'utilisateur au service
    - _→ Req 16.1, 16.4_
  - [x] T1.3.2.4 Déclarer `DashboardModule` et l'ajouter dans les `imports` de `AppModule`
    - `DashboardModule` importe `PrismaModule`
    - _→ Req 16_

- [x] T1.3.3 — Créer le layout protégé (auth) avec sidebar et topbar
  - [x] T1.3.3.1 Créer le route group `apps/frontend/src/app/(auth)/` avec le fichier `layout.tsx` :
    - Composant serveur qui appelle `getSession()`
    - Si `null` → `redirect('/login')`
    - Sinon, rendre le layout : sidebar fixe 260px (desktop) + topbar + zone `children`
    - _→ Req 17.4_
  - [x] T1.3.3.2 Créer le composant `Sidebar` dans `apps/frontend/src/components/layout/sidebar.tsx` :
    - Entrées de menu : Dashboard, Employés, Départements (icônes Lucide)
    - Le menu est filtré en fonction du rôle de l'utilisateur (props `user`)
    - _→ Req 17_
  - [x] T1.3.3.3 Créer le composant `Topbar` dans `apps/frontend/src/components/layout/topbar.tsx` :
    - Affiche le nom de l'utilisateur connecté, icône notifications (Lucide `Bell` avec badge), bouton déconnexion
    - _→ Req 17_

- [x] T1.3.4 — Créer l'écran /dashboard
  - [x] T1.3.4.1 Créer `apps/frontend/src/app/(auth)/dashboard/page.tsx` :
    - Composant serveur qui appelle `GET /api/v1/dashboard` via fetch (avec cookie)
    - Rend des `<DashboardCard>` en grille selon le rôle
    - Contenu par rôle :
      - `EMPLOYEE` : "Mes informations", "Mes documents récents" (placeholder), "Mes notifications" (placeholder)
      - `DEPARTMENT_MANAGER` : "Effectif de mon équipe" (chiffre réel), "Indicateurs du département" (nom), "Documents en attente" (placeholder)
      - `SUPER_ADMIN` : "Effectif global" (chiffre réel), "Activité récente" (vide MVP 1), "Accès rapides" (liens modules)
    - _→ Req 17.1, 17.2_
  - [x] T1.3.4.2 Créer le composant `DashboardCard` dans `apps/frontend/src/components/dashboard/dashboard-card.tsx` :
    - Props : `label`, `value`, `subtitle?`
    - Style : fond `--color-background-surface`, bordure `--color-border`, `border-radius: 8px`, ombre `0 1px 3px rgba(0,0,0,0.06)`
    - Valeur principale : Inter 600, 28–36px pour les chiffres
    - _→ Req 17.3_

- [x] T1.3.5 — Implémenter les états skeleton et erreur sur le dashboard
  - [x] T1.3.5.1 Créer un composant `DashboardSkeleton` dans `apps/frontend/src/components/dashboard/dashboard-skeleton.tsx` :
    - Skeleton qui mime la forme des `DashboardCard` (3 cartes fantômes)
    - Utiliser le pattern `loading.tsx` de Next.js App Router ou Suspense
    - _→ Req 17_
  - [x] T1.3.5.2 Gérer l'état d'erreur dans la page dashboard :
    - Si le fetch échoue ou retourne une erreur, afficher "Impossible de charger le tableau de bord. Réessayer." avec un bouton de retry
    - _→ Req 17_

---

### Étape 1.4 — Module Employés

- [x] T1.4.1 — Créer la structure de fichiers du module EmployeesModule
  - [x] T1.4.1.1 Créer le répertoire `apps/backend/src/employees/` avec les fichiers vides suivants :
    - `employees.module.ts`
    - `employees.controller.ts`
    - `employees.service.ts`
    - `dto/create-employee.dto.ts`
    - `dto/update-employee.dto.ts`
    - `dto/employee-response.dto.ts`
    - `dto/pagination-query.dto.ts`
    - _→ Req 18_

- [x] T1.4.2 — Implémenter les DTOs employés
  - [x] T1.4.2.1 Implémenter `dto/pagination-query.dto.ts` :
    - `page?: number` (défaut 1) : `@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Type(() => Number)`
    - `limit?: number` (défaut 25) : `@IsOptional()`, `@IsInt()`, `@Min(1)`, `@Max(100)`, `@Type(() => Number)`
    - `search?: string` : `@IsOptional()`, `@IsString()`, `@MaxLength(100)`
    - `departmentId?: string` : `@IsOptional()`, `@IsUUID()`
    - `status?: EmploymentStatus` : `@IsOptional()`, `@IsEnum(EmploymentStatus)`
    - _→ Req 18.1_
  - [x] T1.4.2.2 Implémenter `dto/create-employee.dto.ts` :
    - `firstName` : `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)`
    - `lastName` : `@IsString()`, `@IsNotEmpty()`, `@MaxLength(100)`
    - `professionalEmail` : `@IsEmail()`
    - `phone?` : `@IsOptional()`, `@IsPhoneNumber()`
    - `departmentId` : `@IsUUID()`
    - `positionId` : `@IsUUID()`
    - `managerId?` : `@IsOptional()`, `@IsUUID()`
    - `hireDate` : `@IsDateString()`
    - _→ Req 18.3, 18.5_
  - [x] T1.4.2.3 Implémenter `dto/update-employee.dto.ts` :
    - Utiliser `PartialType(CreateEmployeeDto)` de `@nestjs/mapped-types` (tous les champs optionnels)
    - _→ Req 18.4, 18.5_
  - [x] T1.4.2.4 Implémenter `dto/employee-response.dto.ts` :
    - Champs : `id`, `employeeNumber`, `firstName`, `lastName`, `professionalEmail`, `phone`, `departmentId`, `department: { id, name, code }`, `positionId`, `position: { id, title }`, `managerId`, `manager: { id, firstName, lastName } | null`, `employmentStatus`, `hireDate`, `createdAt`, `updatedAt`
    - _→ Req 18.2_

- [x] T1.4.3 — Implémenter GET /api/v1/employees (liste paginée)
  - [x] T1.4.3.1 Implémenter `EmployeesService.findAll(query, user)` :
    - Construire le filtre Prisma `where` à partir de `query` : `search` sur `firstName` + `lastName` (contains insensitive), `departmentId`, `status`
    - Pagination : `skip = (page - 1) * limit`, `take = limit`
    - Inclure les relations `department`, `position`, `manager`
    - Retourner `{ data: EmployeeResponseDto[], total: number, page: number, limit: number }`
    - _→ Req 18.1, 19.1_
  - [x] T1.4.3.2 Créer le handler `GET /employees` dans `EmployeesController` :
    - Décorateurs : `@UseGuards(SessionGuard, RoleGuard, PermissionGuard)`, `@Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')`, `@Permission('employees', 'read')`
    - Paramètres de query validés par `PaginationQueryDto`
    - _→ Req 19.1, 19.5_

- [x] T1.4.4 — Implémenter GET /api/v1/employees/:id (détail)
  - [x] T1.4.4.1 Implémenter `EmployeesService.findOne(id)` :
    - Prisma `findUnique` avec `include` sur `department`, `position`, `manager`
    - Si non trouvé → throw `NotFoundException`
    - Retourner `EmployeeResponseDto`
    - _→ Req 18.2_
  - [x] T1.4.4.2 Créer le handler `GET /employees/:id` dans `EmployeesController` :
    - Décorateurs : `@Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')`, `@Permission('employees', 'read')`
    - _→ Req 19.1, 19.5_

- [x] T1.4.5 — Implémenter POST /api/v1/employees (création avec employeeNumber)
  - [x] T1.4.5.1 Implémenter `EmployeesService.create(dto, user)` :
    - Vérification Department Manager Scope si `user.roles.includes('DEPARTMENT_MANAGER')` : si `dto.departmentId != user.employeeIdentity.departmentId` → throw `ForbiddenException`
    - Générer `employeeNumber` : `GF-{AAAA}-{NNN}` où `AAAA` = année courante et `NNN` = `count(employees) + 1` formaté en 3 chiffres avec `padStart(3, '0')`
    - Créer l'employé via Prisma (vérification de l'intégrité référentielle : `departmentId`, `positionId`, `managerId`)
    - Retourner `EmployeeResponseDto`
    - _→ Req 18.3, 18.6, 18.7, 19.3_
  - [x] T1.4.5.2 Créer le handler `POST /employees` dans `EmployeesController` :
    - Décorateurs : `@Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER')`, `@Permission('employees', 'write')`
    - Retourner HTTP 201
    - _→ Req 19.2, 19.5_

- [x] T1.4.6 — Implémenter PATCH /api/v1/employees/:id (modification)
  - [x] T1.4.6.1 Implémenter `EmployeesService.update(id, dto, user)` :
    - Charger l'employé existant ; si non trouvé → throw `NotFoundException`
    - Vérification Department Manager Scope si applicable : `employee.departmentId != user.employeeIdentity.departmentId` → throw `ForbiddenException` ; si `dto.departmentId` fourni et différent du département du manager → throw `ForbiddenException`
    - Mettre à jour via Prisma `update`
    - Retourner `EmployeeResponseDto`
    - _→ Req 18.4, 18.6, 18.7, 19.3, 19.4_
  - [x] T1.4.6.2 Créer le handler `PATCH /employees/:id` dans `EmployeesController` :
    - Décorateurs : `@Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER')`, `@Permission('employees', 'write')`
    - _→ Req 19.2, 19.5_

- [x] T1.4.7 — Déclarer EmployeesModule et l'ajouter dans AppModule
  - [x] T1.4.7.1 Déclarer `EmployeesModule` dans `employees.module.ts`, importer `PrismaModule`
  - [x] T1.4.7.2 Ajouter `EmployeesModule` dans les `imports` de `AppModule`
    - _→ Req 18_

- [x] T1.4.8 — Créer l'écran /employees (liste paginée avec filtres)
  - [x] T1.4.8.1 Créer `apps/frontend/src/app/(auth)/employees/page.tsx` :
    - Composant client pour les interactions (filtres, pagination)
    - Tableau shadcn/ui customisé GFEP : en-têtes sticky, hauteur de ligne 40px, fond de survol `--color-background-main`
    - Colonnes : nom complet, département, poste, statut (badge sémantique `--color-success`/`--color-warning`/`--color-error`), date d'embauche
    - Filtres au-dessus : recherche texte (nom), sélecteur département, sélecteur statut
    - Pagination en bas : numéros de pages, taille de page
    - Clic sur une ligne → `router.push('/employees/:id')`
    - Bouton "Nouvel employé" (primaire, icône Lucide `UserPlus`) : visible uniquement pour `SUPER_ADMIN` et `DEPARTMENT_MANAGER`
    - _→ Req 20.1, 20.4, 20.6_
  - [x] T1.4.8.2 Implémenter les états skeleton (5 lignes fantômes), vide et erreur sur la liste des employés
    - État vide : icône Lucide + "Aucun employé trouvé"
    - État erreur : "Impossible de charger les employés." + bouton "Réessayer"
    - _→ Req 20.5, 20.6_

- [x] T1.4.9 — Créer l'écran /employees/:id (détail)
  - [x] T1.4.9.1 Créer `apps/frontend/src/app/(auth)/employees/[id]/page.tsx` :
    - Composant serveur qui fetch `GET /api/v1/employees/:id`
    - En-tête : nom complet, badge statut, boutons "Modifier" et "Suspendre" (visibles uniquement pour `SUPER_ADMIN` et `DEPARTMENT_MANAGER`)
    - Section informations personnelles : email, téléphone
    - Section informations professionnelles : département (lien vers `/departments/:id`), poste, responsable (lien), date d'embauche
    - Fil d'Ariane : Employés > Prénom Nom (composant `Breadcrumb` réutilisable)
    - États : skeleton et erreur
    - _→ Req 20.2, 20.4, 20.5_

- [x] T1.4.10 — Créer les écrans /employees/new et /employees/:id/edit (formulaires)
  - [x] T1.4.10.1 Créer `apps/frontend/src/components/employees/employee-form.tsx` (composant client partagé) :
    - React Hook Form + Zod
    - Champs : prénom, nom, email professionnel, téléphone (optionnel), département (sélecteur), poste (sélecteur), responsable (sélecteur, optionnel), date d'embauche
    - Les sélecteurs chargent leurs options depuis l'API (`/api/v1/departments`, `/api/v1/employees`)
    - Labels visibles au-dessus de chaque champ
    - Validation en temps réel après la première tentative de soumission
    - Messages d'erreur sous le champ concerné, couleur `--color-error`
    - Boutons : "Enregistrer" (primaire) + "Annuler" (secondaire, navigue en arrière)
    - _→ Req 20.3, 20.6_
  - [x] T1.4.10.2 Créer `apps/frontend/src/app/(auth)/employees/new/page.tsx` :
    - Rend `<EmployeeForm>` en mode création
    - Soumission : `POST /api/v1/employees`, puis redirect vers `/employees/:id`
    - _→ Req 20.3_
  - [x] T1.4.10.3 Créer `apps/frontend/src/app/(auth)/employees/[id]/edit/page.tsx` :
    - Charge les données existantes via `GET /api/v1/employees/:id`
    - Rend `<EmployeeForm>` en mode édition pré-rempli
    - Soumission : `PATCH /api/v1/employees/:id`, puis redirect vers `/employees/:id`
    - _→ Req 20.3_

- [ ] T1.4.11 — Checkpoint 1.4 (validation manuelle utilisateur en attente)
  - Vérifier que la liste des employés est paginée, que le formulaire de création fonctionne avec `SUPER_ADMIN`, que le rate limiting 403 s'applique correctement, et qu'un `EMPLOYEE` reçoit 403 en tentant de créer un employé.
  - Demander au développeur de valider avant de passer à l'étape suivante.

---

### Étape 1.5 — Module Départements

- [x] T1.5.1 — Créer la structure de fichiers du module DepartmentsModule
  - [x] T1.5.1.1 Créer le répertoire `apps/backend/src/departments/` avec les fichiers vides suivants :
    - `departments.module.ts`
    - `departments.controller.ts`
    - `departments.service.ts`
    - `dto/department-response.dto.ts`
    - _→ Req 21_

- [x] T1.5.2 — Implémenter GET /api/v1/departments (liste avec effectif calculé)
  - [x] T1.5.2.1 Implémenter `dto/department-response.dto.ts` et `DepartmentDetailResponseDto` :
    - `DepartmentResponseDto` : `id`, `name`, `code`, `description`, `headcount: number`, `manager: { id, firstName, lastName, position } | null`, `createdAt`
    - `DepartmentDetailResponseDto extends DepartmentResponseDto` : ajoute `employees: Array<{ id, employeeNumber, firstName, lastName, position, employmentStatus }>`
    - _→ Req 21.1, 21.2_
  - [x] T1.5.2.2 Implémenter `DepartmentsService.findAll()` :
    - Prisma `findMany` avec `include` sur `manager → position` et `_count: { select: { employees: { where: { employmentStatus: 'ACTIVE' } } } }`
    - Mapper `_count.employees` → `headcount`
    - Retourner `DepartmentResponseDto[]`
    - _→ Req 21.3_
  - [x] T1.5.2.3 Créer le handler `GET /departments` dans `DepartmentsController` :
    - Décorateurs : `@UseGuards(SessionGuard, RoleGuard, PermissionGuard)`, `@Roles('SUPER_ADMIN', 'DEPARTMENT_MANAGER', 'EMPLOYEE')`, `@Permission('departments', 'read')`
    - _→ Req 21.4_

- [x] T1.5.3 — Implémenter GET /api/v1/departments/:id (détail avec équipe)
  - [x] T1.5.3.1 Implémenter `DepartmentsService.findOne(id)` :
    - Prisma `findUnique` avec `include` sur `manager → position`, `_count`, `employees (WHERE employmentStatus = ACTIVE) → position`
    - Mapper les données vers `DepartmentDetailResponseDto`
    - Si non trouvé → throw `NotFoundException`
    - _→ Req 21.2, 21.3_
  - [x] T1.5.3.2 Créer le handler `GET /departments/:id` dans `DepartmentsController` :
    - Décorateurs identiques à la liste
    - _→ Req 21.4_
  - [x] T1.5.3.3 Déclarer `DepartmentsModule`, importer `PrismaModule`, ajouter dans `AppModule`
    - _→ Req 21_

- [x] T1.5.4 — Créer l'écran /departments (grille de 6 cartes)
  - [x] T1.5.4.1 Créer `apps/frontend/src/app/(auth)/departments/page.tsx` :
    - Composant serveur qui fetch `GET /api/v1/departments`
    - Grille : 3 colonnes desktop, 2 tablette, 1 mobile (CSS Grid ou Tailwind `grid-cols-3`)
    - Chaque carte : nom du département, code, effectif réel (Inter 600), nom du responsable, icône Lucide pertinente par département (`Building2` pour DG, `Users` pour RH, `Calculator` pour CF, `Monitor` pour IT, `TrendingUp` pour CO, `Shield` pour AC)
    - Clic sur une carte → `router.push('/departments/:id')`
    - États : skeleton (6 cartes fantômes), erreur
    - _→ Req 22.1, 22.3, 22.4_

- [x] T1.5.5 — Créer l'écran /departments/:id (détail avec tableau des employés)
  - [x] T1.5.5.1 Créer `apps/frontend/src/app/(auth)/departments/[id]/page.tsx` :
    - Composant serveur qui fetch `GET /api/v1/departments/:id`
    - En-tête : nom du département, code, effectif
    - Section "Responsable" : nom, poste
    - Section "Équipe" : tableau des employés du département (colonnes : nom, poste, statut), sans pagination (MVP 1)
    - Fil d'Ariane : Départements > Nom du département
    - États : skeleton, erreur (message + retry)
    - _→ Req 22.2, 22.3, 22.4_

---

### Seed MVP 1

- [x] T1.6.1 — Créer le script seed-mvp1.ts
  - [x] T1.6.1.1 Créer `apps/backend/prisma/seed-mvp1.ts` :
    - Initialiser `PrismaClient` en tête du script
    - Suivre l'ordre de création : `departments` → `positions` → `employees` (avec `managerId: null` initialement) → mise à jour des `managerId` employés → mise à jour des `Department.managerId` → `roles` → `permissions` → `role_permissions` → `users` (mot de passe hashé avec `argon2.hash()`) → `employee_identities` → `user_roles`
    - Utiliser `upsert` (ou vérification d'existence) sur chaque entité pour garantir l'idempotence
    - Créer les 6 départements : `DG`, `RH`, `CF`, `IT`, `CO`, `AC` (noms et codes définis dans `design.md` §8.3)
    - Créer les 6 postes (un par département) : Directeur général, Responsable RH, Responsable comptable, Responsable informatique, Responsable commercial, Responsable audit
    - Créer les 5 employés : GF-2026-001 à GF-2026-005 (données dans `design.md` §8.3)
    - Créer les 3 rôles : `SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE`
    - Créer les 6 permissions : `dashboard:read`, `employees:read`, `employees:write`, `employees:delete`, `departments:read`, `departments:write`
    - Créer les `RolePermission` selon le tableau `design.md` §8.3 (SUPER_ADMIN = toutes, DEPARTMENT_MANAGER = 4, EMPLOYEE = 3)
    - Créer les 3 utilisateurs locaux avec `argon2.hash(password)` (mots de passe dans `design.md` §8.3, ne jamais les stocker ni les logger — seulement le hash)
    - Créer les 3 `EmployeeIdentity` (lier chaque `User` à son `Employee`)
    - Créer les 3 `UserRole` (lier chaque `User` à son `Role`, avec `assignedBy = userId` du SUPER_ADMIN ou valeur fixe)
    - _→ Req 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8_
  - [x] T1.6.1.2 Configurer le script dans `apps/backend/package.json` :
    - Ajouter la section `"prisma": { "seed": "tsx prisma/seed-mvp1.ts" }` si absente
    - Vérifier que `tsx` est disponible en `devDependencies` ou l'installer
    - _→ Req 23.1_

---

### Vérification finale

- [x] T1.7.1 — Vérification concrète du critère de passage du lot (Req 24)
  - [x] T1.7.1.1 Vérifier le critère de lint : exécuter `npm run lint` depuis la racine du monorepo — oxlint backend et ESLint frontend doivent passer sans erreur
    - _→ Req 24.1_
  - [x] T1.7.1.2 Vérifier le flux de connexion complet :
    - Exécuter `npx prisma db seed` depuis `apps/backend` pour hydrater la base
    - Se connecter avec `m.keita / GF_Admin2026!` (SUPER_ADMIN) : vérifier HTTP 200, cookie httpOnly posé, redirection vers `/dashboard`, indicateur "Effectif global" affiché avec la valeur correcte
    - Se connecter avec `f.camara / GF_Mgr2026!` (DEPARTMENT_MANAGER) : vérifier que le dashboard affiche l'effectif du département RH
    - Se connecter avec `m.diallo / GF_Emp2026!` (EMPLOYEE) : vérifier que le dashboard affiche uniquement les cartes "EMPLOYEE"
    - _→ Req 24.2_
  - [x] T1.7.1.3 Vérifier le verrouillage de compte après 5 échecs :
    - Soumettre 5 fois `POST /api/v1/auth/login` avec le bon `username` et un mauvais mot de passe
    - Vérifier que `User.status` passe à `LOCKED` en base et qu'une tentative supplémentaire retourne HTTP 401 avec le message générique
    - _→ Req 24.3_
  - [x] T1.7.1.4 Vérifier le rate limiting par IP :
    - Soumettre 5 tentatives de connexion depuis la même IP dans la fenêtre de 15 minutes
    - Vérifier que la 6ème tentative retourne HTTP 429
    - _→ Req 24.4_
  - [x] T1.7.1.5 Vérifier les restrictions EMPLOYEE (403) :
    - Avec le token de session de `m.diallo` (EMPLOYEE), envoyer `POST /api/v1/employees` avec un corps valide
    - Vérifier que la réponse est HTTP 403
    - _→ Req 24.5_
  - [x] T1.7.1.6 Vérifier le Department Manager Scope (403) :
    - Avec le token de session de `f.camara` (DEPARTMENT_MANAGER, département RH), envoyer `PATCH /api/v1/employees/:id` sur un employé d'un autre département (ex: IT)
    - Vérifier que la réponse est HTTP 403
    - _→ Req 24.6_
  - [x] T1.7.1.7 Vérifier l'écran `/departments` :
    - Naviguer vers `/departments` avec un utilisateur connecté
    - Vérifier que les 6 cartes sont affichées avec un effectif non nul et correspondant aux données seedées
    - _→ Req 24.7_
  - [x] T1.7.1.8 Résoudre tout critère échoué avant de considérer le lot terminé
    - _→ Req 24.8_

---

## Notes

- Les sous-tâches marquées `*` sont optionnelles et peuvent être différées pour accélérer le MVP. Les tâches sans `*` doivent être implémentées.
- Chaque tâche référence les exigences de `requirements.md` via la notation `→ Req N`.
- L'ordre des tâches respecte strictement le `06-Implementation-Plan.md` : Lot 0 → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → Seed → Vérification.
- Le schéma Prisma (`schema.prisma`) est conforme tel quel — aucune migration n'est requise pour ce lot.
- Tous les imports NestJS utilisent le suffixe `.js` (résolution ESM, `"type": "module"` dans le `package.json` backend).
- Les mots de passe du seed ne sont jamais stockés ni loggés — uniquement leur hash argon2.
- La tâche T1.7.1 est la dernière et constitue le critère de passage obligatoire du lot.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["T0.1.1", "T0.1.2", "T0.1.3", "T0.2.1", "T0.2.2", "T0.3.1", "T0.3.2", "T0.3.3", "T0.4.1", "T0.6.1", "T0.7.2"] },
    { "id": 1, "tasks": ["T0.1.4", "T0.4.2", "T0.5.1", "T0.5.2", "T0.7.1", "T0.8.1", "T0.9.1"] },
    { "id": 2, "tasks": ["T0.1.5", "T0.2.3", "T0.5.3", "T1.1.1.1", "T1.1.1.2"] },
    { "id": 3, "tasks": ["T1.1.2.1", "T1.1.2.2", "T1.1.2.3", "T1.1.3.1", "T1.1.3.2", "T1.1.3.3"] },
    { "id": 4, "tasks": ["T1.1.4.1", "T1.1.4.2", "T1.1.4.3", "T1.1.5.1", "T1.1.5.2"] },
    { "id": 5, "tasks": ["T1.1.5.3", "T1.1.6.1", "T1.1.6.2", "T1.1.6.3"] },
    { "id": 6, "tasks": ["T1.1.6.4", "T1.1.7.1", "T1.1.7.2", "T1.1.8.1"] },
    { "id": 7, "tasks": ["T1.1.9.1", "T1.2.1.1"] },
    { "id": 8, "tasks": ["T1.1.9.2", "T1.2.2.1", "T1.2.2.2"] },
    { "id": 9, "tasks": ["T1.2.3.1", "T1.2.4.1"] },
    { "id": 10, "tasks": ["T1.2.5.1", "T1.2.5.2"] },
    { "id": 11, "tasks": ["T1.3.1.1", "T1.3.3.1"] },
    { "id": 12, "tasks": ["T1.3.2.1", "T1.3.2.2", "T1.3.3.2", "T1.3.3.3"] },
    { "id": 13, "tasks": ["T1.3.2.3", "T1.3.4.1", "T1.3.4.2"] },
    { "id": 14, "tasks": ["T1.3.2.4", "T1.3.5.1", "T1.3.5.2", "T1.4.1.1"] },
    { "id": 15, "tasks": ["T1.4.2.1", "T1.4.2.2", "T1.4.2.3", "T1.4.2.4"] },
    { "id": 16, "tasks": ["T1.4.3.1", "T1.4.4.1"] },
    { "id": 17, "tasks": ["T1.4.3.2", "T1.4.4.2", "T1.4.5.1"] },
    { "id": 18, "tasks": ["T1.4.5.2", "T1.4.6.1"] },
    { "id": 19, "tasks": ["T1.4.6.2", "T1.4.7.1"] },
    { "id": 20, "tasks": ["T1.4.7.2", "T1.4.8.1", "T1.4.8.2"] },
    { "id": 21, "tasks": ["T1.4.9.1", "T1.4.10.1"] },
    { "id": 22, "tasks": ["T1.4.10.2", "T1.4.10.3", "T1.5.1.1"] },
    { "id": 23, "tasks": ["T1.5.2.1", "T1.5.2.2"] },
    { "id": 24, "tasks": ["T1.5.2.3", "T1.5.3.1"] },
    { "id": 25, "tasks": ["T1.5.3.2", "T1.5.3.3", "T1.5.4.1"] },
    { "id": 26, "tasks": ["T1.5.5.1"] },
    { "id": 27, "tasks": ["T1.6.1.1"] },
    { "id": 28, "tasks": ["T1.6.1.2"] },
    { "id": 29, "tasks": ["T1.7.1.1", "T1.7.1.2", "T1.7.1.3", "T1.7.1.4", "T1.7.1.5", "T1.7.1.6", "T1.7.1.7", "T1.7.1.8"] }
  ]
}
```
