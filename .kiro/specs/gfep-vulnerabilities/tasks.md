# Plan d'implémentation — Enterprise Breach : Vulnérabilités pédagogiques GFEP

Branche : `vulnerabilities-phase`. Un scénario à la fois, dans l'ordre WEB-01 → 08. Un commit par scénario, après validation manuelle par l'utilisateur.

**Règles communes à chaque tâche :**
- Tâche 0 obligatoire avant chaque scénario : `docker ps` (gfep_postgres healthy), `npm run lint`, `npm run build`, `npm test` tous verts.
- Double preuve obligatoire : exploitation (LAB_MODE=true) + blocage (LAB_MODE=false).
- Aucune case de validation manuelle cochée par l'agent — l'utilisateur les coche après test depuis Parrot.
- Arrêt immédiat si nouvelle ambiguïté → question avant de coder.
- Commit unique par scénario, après validation manuelle.

---

## Infrastructure commune (avant WEB-01)

- [ ] **T-INFRA-1 — `LabModule` conditionnel**
  - `src/lab/lab.module.ts` : module NestJS vide, importé dans `AppModule` si `process.env.LAB_MODE === 'true'`.
  - `src/lab/lab-mode.guard.ts` : `LabModeGuard` vérifiant `LAB_MODE` au runtime.
  - `src/lab/lab-logger.service.ts` : `LabLoggerService` loguant `{ scenarioCode, actorId, sourceIp, timestamp, result }`, jamais de données sensibles.
  - Test : `test/lab-infra.spec.ts` — vérifie que `GET /api/v1/lab/ping` retourne 404 quand `LAB_MODE=false`, 200 quand `LAB_MODE=true`.

- [ ] **T-INFRA-2 — README avertissement**
  - Ajouter section `## ⚠️ LAB_MODE` dans `apps/backend/README.md`.

- [ ] **T-INFRA-3 — Seed de lab**
  - `prisma/seed-lab.ts` : insère les 8 entrées `LabScenario` avec `enabled=false`.
  - Commande : `npx tsx prisma/seed-lab.ts`.
  - Test : `test/lab-seed.spec.ts` — vérifie les 8 entrées et `enabled=false` sur toutes.

- [ ] **T-INFRA-C — Commit « Lab : infrastructure commune »**

---

## WEB-01 — SQL Injection

- [ ] **T-WEB01-0 — Vérifications de départ** : lint, build, test verts.

- [ ] **T-WEB01-1 — Contrôleur et service**
  - `src/lab/scenarios/web01-sqli/web01.controller.ts` : `GET /employees/search?q=`
  - `src/lab/scenarios/web01-sqli/web01.service.ts` : `prisma.$queryRawUnsafe()` avec concaténation directe de `q`.
  - Guards RBAC intacts : `@Roles(...READ_ROLES)` + `@Permission('employees', 'read')`.
  - Colonnes SELECT : `id`, `employeeNumber`, `firstName`, `lastName`, `email`, `departmentId`, `positionId`, `managerId` (8 colonnes — le UNION doit matcher).
  - Colonnes UNION exfiltrées : `id`, `username`, `email`, `passwordHash`, et 4 NULL pour compléter.

- [ ] **T-WEB01-2 — Tests automatisés**
  - `test/lab-web01.int-spec.ts` :
    - `LAB_MODE=true` : payload UNION retourne `passwordHash` dans la réponse.
    - `LAB_MODE=false` : `GET /employees/search?q=test` → 404.
    - Fonctionnement normal (q='Mamadou') → retourne des employés (pas d'injection).

- [ ] **T-WEB01-3 — Curl de démonstration** (dans `apps/backend/AGENTS.md` section Lab) :
  ```bash
  # Exploitation WEB-01
  curl -b "gfep_session=<token>" \
    "http://localhost:3001/api/v1/employees/search?q=%27%20UNION%20SELECT%20id%2C%20username%2C%20email%2C%20%22passwordHash%22%2C%20NULL%2C%20NULL%2C%20NULL%2C%20NULL%20FROM%20users%20--"
  # Blocage (LAB_MODE=false)
  curl "http://localhost:3001/api/v1/employees/search?q=test"  # → 404
  ```

- [ ] **T-WEB01-V — Validation manuelle utilisateur (Parrot)** — cochée par l'utilisateur uniquement.
- [ ] **T-WEB01-C — Commit « WEB-01 : SQL Injection »**

---

## WEB-02 — IDOR

- [ ] **T-WEB02-0 — Vérifications de départ.**

- [ ] **T-WEB02-1 — Contrôleur et service**
  - `src/lab/scenarios/web02-idor/web02.controller.ts` : `GET /lab/documents/:id/download-vuln`
  - `src/lab/scenarios/web02-idor/web02.service.ts` : `prisma.document.findUnique()` direct (sans `findVisibleDocument`, sans M9).
  - Guards RBAC intacts : `@Roles(...DOCUMENT_ROLES)` + `@Permission('documents', 'read')`.
  - Retourne le fichier avec le `Content-Type` réel.

- [ ] **T-WEB02-2 — Tests automatisés**
  - `test/lab-web02.int-spec.ts` :
    - `LAB_MODE=true` : EMPLOYEE du département CF télécharge document RESTRICTED du département DG → 200 et contenu du fichier.
    - Même requête avec la route de production `GET /documents/:id/download` → 404 (document non visible pour cet utilisateur).
    - `LAB_MODE=false` : `GET /lab/documents/:id/download-vuln` → 404.

- [ ] **T-WEB02-V — Validation manuelle.**
- [ ] **T-WEB02-C — Commit « WEB-02 : IDOR »**

---

## WEB-07 — Mass Assignment

- [ ] **T-WEB07-0 — Vérifications de départ.**

- [ ] **T-WEB07-1 — DTO et contrôleur**
  - `src/lab/scenarios/web07-massassign/web07-update.dto.ts` : `LabUpdateEmployeeDto` avec `positionId?` et `departmentId?` (champs sensibles).
  - `src/lab/scenarios/web07-massassign/web07.controller.ts` : `PATCH /lab/employees/:id/update-vuln`.
  - Pas de vérification de scope (un EMPLOYEE peut modifier n'importe quel employé, y compris lui-même).
  - Guards : `@Roles(...READ_ROLES)` + `@Permission('employees', 'read')` (permission de lecture suffit — faille intentionnelle).

- [ ] **T-WEB07-2 — Tests automatisés**
  - `test/lab-web07.int-spec.ts` :
    - `LAB_MODE=true` : EMPLOYEE modifie son propre `positionId` et `departmentId` → 200, valeurs mises à jour en base.
    - Route de production `PATCH /employees/:id` avec ces champs → 400 (whitelist rejette `positionId`/`departmentId` dans `UpdateEmployeeDto`).
    - `LAB_MODE=false` : `PATCH /lab/employees/:id/update-vuln` → 404.

- [ ] **T-WEB07-V — Validation manuelle.**
- [ ] **T-WEB07-C — Commit « WEB-07 : Mass Assignment »**

---

## WEB-03 — Broken Access Control

- [ ] **T-WEB03-0 — Vérifications de départ.**

- [ ] **T-WEB03-1 — DTO et contrôleur**
  - `src/lab/dto/lab-role-assign.dto.ts` : `LabRoleAssignDto { @IsString() roleName: string }`.
  - `src/lab/scenarios/web03-bac/web03.controller.ts` : `POST /lab/admin/users/:id/role`.
  - `@Public()` — pas d'authentification requise.
  - Écrit dans `user_roles` sans aucune vérification d'identité ni de hiérarchie.

- [ ] **T-WEB03-2 — Tests automatisés**
  - `test/lab-web03.int-spec.ts` :
    - `LAB_MODE=true` : requête sans cookie → 200, le compte cible a désormais SUPER_ADMIN dans `user_roles`.
    - `LAB_MODE=false` : `POST /lab/admin/users/:id/role` sans cookie → 404.
    - Vérification que la route de production `PUT /access/users/:id/roles` sans session → 401 (non touchée).

- [ ] **T-WEB03-V — Validation manuelle.**
- [ ] **T-WEB03-C — Commit « WEB-03 : Broken Access Control »**

---

## WEB-05 — Unrestricted File Upload

- [ ] **T-WEB05-0 — Vérifications de départ.**

- [ ] **T-WEB05-1 — Contrôleur**
  - `src/lab/scenarios/web05-upload/web05.controller.ts` : `POST /lab/documents/upload-vuln`.
  - `FileInterceptor('file')` sans `limits`.
  - Pas de `detectAllowedFileType`.
  - `mimeType` stocké = `file.mimetype` (déclaré par le client, non vérifié).
  - Route de téléchargement lab : `GET /lab/documents/:id/download-vuln` retourne le `Content-Type` réel stocké.

- [ ] **T-WEB05-2 — Tests automatisés**
  - `test/lab-web05.int-spec.ts` :
    - `LAB_MODE=true` : upload d'un fichier avec `Content-Type: application/x-php` → 201, téléchargement retourne `Content-Type: application/x-php`.
    - `LAB_MODE=true` : upload d'un fichier > 10 Mo → 201 (pas de limite).
    - Route de production `POST /documents/upload` avec fichier `.php` → 400 (signature invalide).
    - `LAB_MODE=false` : `POST /lab/documents/upload-vuln` → 404.

- [ ] **T-WEB05-V — Validation manuelle.**
- [ ] **T-WEB05-C — Commit « WEB-05 : Unrestricted File Upload »**

---

## WEB-04 — Stored XSS

- [ ] **T-WEB04-0 — Vérifications de départ.**

- [ ] **T-WEB04-1 — Migration `document_comments`**
  - Ajouter `DocumentComment` dans `schema.prisma`.
  - `npx prisma migrate dev --name add_document_comments`.
  - Vérifier : uniquement des `CREATE`, aucun `DROP`.
  - Mettre à jour `05-Backend-Schema.md` §3 et `src/prisma/schema.spec.ts` (24 modèles).

- [ ] **T-WEB04-2 — Contrôleur**
  - `src/lab/scenarios/web04-xss/web04.controller.ts` :
    - `POST /lab/documents/:id/comments` : stocke `content` brut sans sanitisation.
    - `GET /lab/documents/:id/comments` : retourne `content` brut.
  - Guards : `@Roles(...DOCUMENT_ROLES)` + `@Permission('documents', 'read')`.

- [ ] **T-WEB04-3 — Tests automatisés**
  - `test/lab-web04.int-spec.ts` :
    - `LAB_MODE=true` : `POST` d'un commentaire `<script>alert('XSS')</script>` → stocké, `GET` retourne le contenu brut.
    - `LAB_MODE=false` : les deux routes → 404.

- [ ] **T-WEB04-V — Validation manuelle.**
- [ ] **T-WEB04-C — Commit « WEB-04 : Stored XSS »**

---

## WEB-06 — Session Fixation

- [ ] **T-WEB06-0 — Vérifications de départ.**

- [ ] **T-WEB06-1 — Contrôleur de login vulnérable**
  - `src/lab/scenarios/web06-session/web06.controller.ts` : `POST /lab/auth/login-vuln`.
  - Réplique le flux `POST /auth/login` (appel à `AuthService.login` ou copie minimale).
  - Si le header `X-Session-Fix: <token>` est présent, utilise ce token comme jeton de session (hash SHA-256 stocké en base) au lieu de `randomBytes(48)`.
  - Le cookie `gfep_session` est posé avec ce token.

- [ ] **T-WEB06-2 — Tests automatisés**
  - `test/lab-web06.int-spec.ts` :
    - `LAB_MODE=true` :
      - Login avec `X-Session-Fix: fixedtoken123` → cookie `gfep_session=fixedtoken123` dans `Set-Cookie`.
      - Requête `GET /api/v1/auth/me` avec `Cookie: gfep_session=fixedtoken123` → 200 (authentifié en tant que la victime).
    - `LAB_MODE=true` : login sans `X-Session-Fix` → token aléatoire (comportement normal de la route lab).
    - `LAB_MODE=false` : `POST /lab/auth/login-vuln` → 404.
    - Route de production `POST /auth/login` non modifiée : login → token aléatoire `randomBytes(48)`.

- [ ] **T-WEB06-V — Validation manuelle.**
- [ ] **T-WEB06-C — Commit « WEB-06 : Session Fixation »**

---

## WEB-08 — Command Injection

- [ ] **T-WEB08-0 — Vérifications de départ.**

- [ ] **T-WEB08-1 — DTO et contrôleur**
  - `src/lab/dto/lab-convert.dto.ts` : `LabConvertDto { @IsString() format: string }` — aucune validation stricte (c'est la faille).
  - `src/lab/scenarios/web08-cmdi/web08.controller.ts` : `POST /lab/documents/:id/convert`.
  - `src/lab/scenarios/web08-cmdi/web08.service.ts` :
    - `spawn('cmd.exe', ['/c', 'convert --format ' + format + ' NUL'])`.
    - CWD : `C:\gfep-lab-scratch\` (créé si absent avec `fs.mkdir`).
    - Env : `{ PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }` uniquement.
    - Timeout 5 s, `killSignal: 'SIGKILL'`.
    - Sortie tronquée à 4 KB.
    - Réponse : `{ output: string }`.
  - Guards : `@Roles(...DOCUMENT_ROLES)` + `@Permission('documents', 'read')`.

- [ ] **T-WEB08-2 — Tests automatisés**
  - `test/lab-web08.int-spec.ts` :
    - `LAB_MODE=true` : `format='pdf& whoami'` → réponse contient `whoami` dans `output`.
    - `LAB_MODE=true` : `format='pdf'` (sans injection) → pas d'erreur de confinement.
    - `LAB_MODE=true` : output > 4 KB → tronqué à 4096 caractères.
    - `LAB_MODE=false` : `POST /lab/documents/:id/convert` → 404.

- [ ] **T-WEB08-V — Validation manuelle.**
- [ ] **T-WEB08-C — Commit « WEB-08 : Command Injection »**

---

## Critère de passage global

- [ ] **T-FINAL-1 — Lint, build, test complets** : `npm run lint`, `npm run build`, `npm test` (tous scénarios).
- [ ] **T-FINAL-2 — Vérification double preuve** : chaque scénario a son curl d'exploitation ET sa preuve de blocage documentés dans `apps/backend/AGENTS.md`.
- [ ] **T-FINAL-3 — PROGRESS.md** mis à jour (ligne « Enterprise Breach — Vulnérabilités »).
- [ ] **T-FINAL-V — Validation manuelle globale** — cochée par l'utilisateur après test depuis Parrot sur tous les scénarios.
- [ ] **T-FINAL-C — Commit final « Enterprise Breach : 8 scénarios WEB complets »**
