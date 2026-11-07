# Design — Enterprise Breach : Vulnérabilités pédagogiques GFEP

---

## 1. Architecture globale

### 1.1 Activation conditionnelle

```typescript
// src/app.module.ts — import conditionnel
const labModules = process.env.LAB_MODE === 'true' ? [LabModule] : [];

@Module({
  imports: [
    // ... modules de production existants ...
    ...labModules,
  ],
})
export class AppModule {}
```

`LAB_MODE` est évalué **une seule fois** à la compilation du module, au démarrage du processus. Aucune réévaluation en cours de vie de l'application.

### 1.2 Structure du LabModule

```
src/lab/
  lab.module.ts                    # Module NestJS, importé seulement si LAB_MODE=true
  lab-mode.guard.ts                # Guard vérifiant LAB_MODE au runtime (défense en profondeur)
  lab-logger.service.ts            # Logging propre : scenarioCode/actorId/IP/timestamp uniquement
  scenarios/
    web01-sqli/
      web01.controller.ts          # GET /employees/search
      web01.service.ts
    web02-idor/
      web02.controller.ts          # surcharge GET /documents/:id/download
      web02.service.ts
    web03-bac/
      web03.controller.ts          # POST /lab/admin/users/:id/role (@Public)
      web03.service.ts
    web04-xss/
      web04.controller.ts          # GET/POST /documents/:id/comments
      web04.service.ts
    web05-upload/
      web05.controller.ts          # surcharge POST /documents/upload
      web05.service.ts
    web06-session/
      web06-session.interceptor.ts # intercepteur sur POST /auth/login
    web07-massassign/
      web07.controller.ts          # surcharge PATCH /employees/:id
      web07-update.dto.ts          # LabUpdateEmployeeDto
    web08-cmdi/
      web08.controller.ts          # POST /lab/documents/:id/convert
      web08.service.ts
  dto/
    lab-role-assign.dto.ts
    lab-convert.dto.ts
```

### 1.3 LabModeGuard (défense en profondeur)

Même si `LabModule` est importé uniquement quand `LAB_MODE=true`, un guard supplémentaire est appliqué globalement dans `LabModule` pour rejeter toute requête si `LAB_MODE` a changé en cours de vie du processus (cas théorique, impossibele via l'API, mais guard de sécurité) :

```typescript
@Injectable()
export class LabModeGuard implements CanActivate {
  canActivate(): boolean {
    return process.env.LAB_MODE === 'true';
  }
}
```

### 1.4 LabLoggerService

```typescript
interface LabLogEntry {
  scenarioCode: string;    // 'WEB-01' .. 'WEB-08'
  actorId: string | null;  // userId ou null si non authentifié
  sourceIp: string;
  timestamp: string;       // ISO 8601
  result: 'exploited' | 'blocked' | 'error';
}
```

Jamais dans ce log : données SQL exfiltrées, output de commande, contenu de fichier, hash de mot de passe.

---

## 2. Scénarios — détail technique

### WEB-01 — SQL Injection

**Contrôleur** : `Web01Controller` — `GET /employees/search`

```typescript
@Get('employees/search')
@Roles(...READ_ROLES)               // Guard RBAC intact : requiert employees:read
@Permission('employees', 'read')
async search(@Query('q') q: string, @Req() req: Request) {
  // Concaténation volontairement non paramétrée
  const rows = await this.prisma.$queryRawUnsafe(
    `SELECT id, "employeeNumber", "firstName", "lastName", email FROM employees WHERE "firstName" ILIKE '%${q}%'`
  );
  this.labLogger.log({ scenarioCode: 'WEB-01', actorId: req.user?.id ?? null, sourceIp: req.ip ?? '', result: 'exploited' });
  return rows;
}
```

**Payload de démonstration** (curl) :
```bash
curl -b "gfep_session=<token>" \
  "http://localhost:3001/api/v1/employees/search?q=%27%20UNION%20SELECT%20id%2C%20username%2C%20email%2C%20%22passwordHash%22%2C%20NULL%2C%20NULL%2C%20NULL%2C%20NULL%20FROM%20users%20--"
```

**Nombre de colonnes** : la table `employees` a 8 colonnes dans le SELECT de base (`id`, `employeeNumber`, `firstName`, `lastName`, `email`, `departmentId`, `positionId`, `managerId`) — le UNION doit matcher ce nombre. Ajuster au moment de l'implémentation selon le SELECT exact.

**Preuve de blocage** : `GET /api/v1/employees/search?q=test` avec `LAB_MODE=false` → 404 Not Found (route non enregistrée).

---

### WEB-02 — IDOR

**Contrôleur** : `Web02Controller` — même route `GET /documents/:id/download` que la production, mais enregistrée en premier dans `LabModule` (NestJS résout le premier contrôleur enregistré pour une route donnée quand `LabModule` est importé avant `DocumentsModule`).

**Implémentation** :
```typescript
@Get('documents/:id/download')
@Roles(...DOCUMENT_ROLES)
@Permission('documents', 'read')
async download(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Res() res: Response) {
  // findUnique direct : pas de findVisibleDocument, pas de M9
  const document = await this.prisma.document.findUnique({
    where: { id },
    include: { ... }
  });
  if (!document) throw new NotFoundException('Document introuvable.');
  const buffer = await readDocumentFile(document.storagePath);
  this.labLogger.log({ scenarioCode: 'WEB-02', actorId: req.user?.id ?? null, sourceIp: req.ip ?? '', result: 'exploited' });
  res.set({ 'Content-Type': document.mimeType, 'Content-Disposition': `attachment; filename="${document.title}"` });
  res.send(buffer);
}
```

**Note sur la surcharge de route** : `LabModule` doit être importé **après** `DocumentsModule` dans `AppModule` (ordre inversé par rapport à l'intuitif) pour que le contrôleur de lab soit résolu en premier par le routeur NestJS — vérifier à l'implémentation. Alternative plus propre : `LabModule` monte les routes de surcharge avec `@Controller('lab-override/documents')` et le frontend de test utilise cette route de lab, sans conflits.

**Décision retenue** : routes de lab préfixées `/api/v1/lab/documents/:id/download-vuln` pour éviter tout conflit avec la production, documenté dans le guide d'attaque.

---

### WEB-03 — Broken Access Control

**Contrôleur** : `Web03Controller` — `POST /lab/admin/users/:id/role`

```typescript
@Controller('lab/admin/users')
export class Web03Controller {
  @Post(':id/role')
  @Public()                          // Pas d'authentification requise
  @HttpCode(200)
  async assignRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LabRoleAssignDto, @Req() req: Request) {
    const role = await this.prisma.role.findUnique({ where: { name: dto.roleName } });
    if (!role) throw new NotFoundException('Rôle introuvable.');
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: id, roleId: role.id } },
      create: { userId: id, roleId: role.id, assignedBy: 'lab-exploit' },
      update: {},
    });
    this.labLogger.log({ scenarioCode: 'WEB-03', actorId: null, sourceIp: req.ip ?? '', result: 'exploited' });
    return { message: `Rôle ${dto.roleName} attribué.` };
  }
}
```

**DTO** : `LabRoleAssignDto { @IsString() roleName: string }` — aucune validation sur le nom du rôle (c'est la faille).

---

### WEB-04 — Stored XSS

**Migration** : nouvelle table `document_comments` (migration permanente, indépendante de `LAB_MODE`).

**Contrôleur** : `Web04Controller`

```typescript
@Post('documents/:id/comments')
@Roles(...DOCUMENT_ROLES)
@Permission('documents', 'read')    // Lire suffit pour commenter (faille : pas de permission dédiée)
async addComment(@Param('id', ParseUUIDPipe) id: string, @Body() body: { content: string }, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
  const comment = await this.prisma.documentComment.create({
    data: { documentId: id, authorId: user.id, content: body.content }  // Pas de sanitisation
  });
  this.labLogger.log({ scenarioCode: 'WEB-04', actorId: user.id, sourceIp: req.ip ?? '', result: 'exploited' });
  return comment;
}

@Get('documents/:id/comments')
@Roles(...DOCUMENT_ROLES)
@Permission('documents', 'read')
async getComments(@Param('id', ParseUUIDPipe) id: string) {
  return this.prisma.documentComment.findMany({
    where: { documentId: id },
    orderBy: { createdAt: 'desc' },
    // content retourné brut (LAB_MODE=true) — c'est la faille
  });
}
```

**Blocage (LAB_MODE=false)** : le `GET` et `POST` des commentaires n'existent pas (routes de lab). Le contenu est encodé dans le `GET` si les routes existent en lecture seule via un contrôleur de production sécurisé (voir §3).

---

### WEB-05 — Unrestricted File Upload

**Route de lab** : `POST /api/v1/lab/documents/upload-vuln` (préfixe lab pour éviter le conflit).

```typescript
@Post('lab/documents/upload-vuln')
@Roles(...DOCUMENT_ROLES)
@Permission('documents', 'write')
@UseInterceptors(FileInterceptor('file'))    // Pas de limite de taille
async uploadVuln(@UploadedFile() file: Express.Multer.File, @Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
  // Pas de detectAllowedFileType
  // Pas de vérification MAX_FILE_SIZE
  const storagePath = await writeDocumentFile(file.buffer);
  // Stockage du mimeType déclaré par le client (pas détecté)
  const document = await this.prisma.document.create({
    data: { ..., mimeType: file.mimetype, storagePath, fileSize: file.size }
  });
  this.labLogger.log({ scenarioCode: 'WEB-05', actorId: user.id, sourceIp: req.ip ?? '', result: 'exploited' });
  return toDto(document);
}
```

**Téléchargement** : `GET /api/v1/lab/documents/:id/download-vuln` retourne `Content-Type: <mimeType stocké>` sans substitution.

---

### WEB-06 — Session Fixation

**Intercepteur** : `Web06SessionInterceptor` — `NestInterceptor` appliqué uniquement dans `LabModule` sur la route `POST /auth/login`.

**Mécanisme** : `LabModule` expose un `Web06AuthController` qui surcharge `POST /auth/login` avec l'intercepteur injecté :

```typescript
// web06-session.interceptor.ts
@Injectable()
export class Web06SessionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const fixToken = req.headers['x-session-fix'];
    if (typeof fixToken === 'string' && fixToken.length > 0) {
      req['labSessionFix'] = fixToken;    // transmis au service via req
    }
    return next.handle();
  }
}
```

**AuthService** (modifié sous LAB_MODE) : dans `openSession`, si `req['labSessionFix']` est défini, utiliser ce token au lieu de `randomBytes(48)`. Le hash SHA-256 du token fixé est stocké en base.

**Alternative plus propre** : `LabModule` monte un `Web06AuthController` sur `POST /lab/auth/login-vuln` qui réplique le flux de login avec fixation — évite de modifier `AuthService` directement.

**Décision retenue** : route séparée `/api/v1/lab/auth/login-vuln` avec comportement de fixation de session. Cela ne touche pas au code de production.

---

### WEB-07 — Mass Assignment

**Route de lab** : `PATCH /api/v1/lab/employees/:id/update-vuln`

**DTO vulnérable** :
```typescript
export class LabUpdateEmployeeDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsUUID() positionId?: string;    // Faille : champ sensible accepté
  @IsOptional() @IsUUID() departmentId?: string;  // Faille : champ sensible accepté
  @IsOptional() @IsUUID() managerId?: string;
}
```

**Contrôleur** :
```typescript
@Patch('lab/employees/:id/update-vuln')
@Roles(...READ_ROLES)               // Tous les rôles peuvent accéder — faille intentionnelle
@Permission('employees', 'read')    // Permission de lecture suffit — faille intentionnelle
async updateVuln(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LabUpdateEmployeeDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
  // Pas de vérification de scope : un EMPLOYEE peut modifier n'importe quel employé
  const employee = await this.prisma.employee.update({
    where: { id },
    data: { positionId: dto.positionId, departmentId: dto.departmentId, managerId: dto.managerId, firstName: dto.firstName, lastName: dto.lastName },
  });
  this.labLogger.log({ scenarioCode: 'WEB-07', actorId: user.id, sourceIp: req.ip ?? '', result: 'exploited' });
  return employee;
}
```

---

### WEB-08 — Command Injection

**Route** : `POST /api/v1/lab/documents/:id/convert`

**Corps** : `{ format: string }` — `format` non validé, non échappé.

```typescript
@Post('lab/documents/:id/convert')
@Roles(...DOCUMENT_ROLES)
@Permission('documents', 'read')
async convert(@Param('id') id: string, @Body('format') format: string, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
  const scratchDir = 'C:\\gfep-lab-scratch';
  // Créer le répertoire scratch si absent
  await fs.mkdir(scratchDir, { recursive: true });

  const output = await new Promise<string>((resolve) => {
    const child = spawn('cmd.exe', ['/c', `convert --format ${format} NUL`], {
      cwd: scratchDir,
      env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? 'C:\\Windows' },
      timeout: 5000,
      killSignal: 'SIGKILL',
    });
    let buf = '';
    child.stdout.on('data', (d: Buffer) => { buf += d.toString(); if (buf.length > 4096) buf = buf.slice(0, 4096); });
    child.stderr.on('data', (d: Buffer) => { buf += d.toString(); if (buf.length > 4096) buf = buf.slice(0, 4096); });
    child.on('close', () => resolve(buf.slice(0, 4096)));
    child.on('error', (e) => resolve(`ERROR: ${e.message}`));
  });

  this.labLogger.log({ scenarioCode: 'WEB-08', actorId: user.id, sourceIp: req.ip ?? '', result: 'exploited' });
  return { output };
}
```

**Payloads de démonstration** :
- `format=pdf& whoami` → affiche `gnpaytrust\svc-webapp`
- `format=pdf& dir C:\` → liste le répertoire racine
- `format=pdf& type C:\Windows\System32\drivers\etc\hosts` → contenu du fichier hosts

---

## 3. Seed de lab

```typescript
// prisma/seed-lab.ts
const scenarios = [
  { scenarioCode: 'WEB-01', name: 'SQL Injection — employees/search', vulnerabilityCategory: 'Injection', description: 'UNION-based SQL injection via paramètre de recherche non paramétré.', mode: 'lab', enabled: false },
  { scenarioCode: 'WEB-02', name: 'IDOR — documents/download', vulnerabilityCategory: 'Broken Object Level Authorization', description: 'Accès direct à un objet sans vérification de visibilité M9.', mode: 'lab', enabled: false },
  { scenarioCode: 'WEB-03', name: 'Broken Access Control — elévation de rôle', vulnerabilityCategory: 'Broken Access Control', description: 'Endpoint sans authentification permettant l\'élévation de privilèges.', mode: 'lab', enabled: false },
  { scenarioCode: 'WEB-04', name: 'Stored XSS — commentaires de documents', vulnerabilityCategory: 'XSS', description: 'Injection de script via champ commentaire sans sanitisation.', mode: 'lab', enabled: false },
  { scenarioCode: 'WEB-05', name: 'Unrestricted File Upload', vulnerabilityCategory: 'Security Misconfiguration', description: 'Upload de fichier sans vérification de type ni de taille.', mode: 'lab', enabled: false },
  { scenarioCode: 'WEB-06', name: 'Session Fixation', vulnerabilityCategory: 'Session Management', description: 'Fixation de jeton de session via header X-Session-Fix.', mode: 'lab', enabled: false },
  { scenarioCode: 'WEB-07', name: 'Mass Assignment — modification d\'employé', vulnerabilityCategory: 'Mass Assignment', description: 'DTO acceptant des champs sensibles sans restriction de scope.', mode: 'lab', enabled: false },
  { scenarioCode: 'WEB-08', name: 'Command Injection — convert', vulnerabilityCategory: 'Injection', description: 'Injection de commande Windows via paramètre format non échappé.', mode: 'lab', enabled: false },
];
```

---

## 4. Migration DocumentComment

Nouvelle migration `add_document_comments` :
```sql
CREATE TABLE "document_comments" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "document_comments_documentId_idx" ON "document_comments"("documentId");
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Migration permanente — indépendante de `LAB_MODE`. Uniquement des `CREATE`, aucun `DROP`.

---

## 5. Routes — récapitulatif

| Scénario | Route (LAB_MODE=true) | Route de production touchée ? |
|---|---|---|
| WEB-01 | `GET /api/v1/employees/search` | Non (nouvelle route) |
| WEB-02 | `GET /api/v1/lab/documents/:id/download-vuln` | Non (route parallèle) |
| WEB-03 | `POST /api/v1/lab/admin/users/:id/role` | Non |
| WEB-04 | `GET/POST /api/v1/lab/documents/:id/comments` | Non |
| WEB-05 | `POST /api/v1/lab/documents/upload-vuln` | Non |
| WEB-06 | `POST /api/v1/lab/auth/login-vuln` | Non (route parallèle) |
| WEB-07 | `PATCH /api/v1/lab/employees/:id/update-vuln` | Non (route parallèle) |
| WEB-08 | `POST /api/v1/lab/documents/:id/convert` | Non (nouvelle route) |

**Principe retenu** : toutes les routes vulnérables sont sur des chemins `/api/v1/lab/...` ou des nouvelles routes (`/employees/search`). Aucune route de production n'est modifiée ni surchargée. Cela simplifie la preuve de blocage (LAB_MODE=false → 404 sur toutes les routes de lab) et élimine le risque de conflit de routage.

---

## 6. Test pattern

Pour chaque scénario, deux tests automatisés dans `test/lab-webXX.int-spec.ts` :

```typescript
describe('WEB-XX — <nom> (lab)', () => {
  describe('LAB_MODE=true', () => {
    it('exploitation réussie : résultat attendu obtenu', ...);
  });
  describe('LAB_MODE=false (production)', () => {
    it('route absente → 404', ...);
    // OU pour les failles intra-flux :
    it('comportement sécurisé de production', ...);
  });
});
```

Les tests utilisent `createTestApp()` avec `process.env.LAB_MODE = 'true'` ou sans, pour les deux branches.
