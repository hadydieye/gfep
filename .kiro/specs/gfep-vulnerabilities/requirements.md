# Requirements — Enterprise Breach : Vulnérabilités pédagogiques GFEP

Branche : `vulnerabilities-phase` — tag de référence propre : `v-mvp3-clean` (ne jamais modifier ce tag, ne jamais fusionner vers `main` sans accord explicite).

Document de référence : « Enterprise Breach — Cahier des charges complet » (sections 6, 7, 9.1, 9.2, 9.3, 12, 14).
Divergence assumée : le domaine est `gnpaytrust.local` / « Guinea Pay Trust » partout.

---

## 1. Objectif

Introduire 8 vulnérabilités web pédagogiques dans l'application GFEP, **actives uniquement quand `LAB_MODE=true`**, pour permettre des démonstrations d'attaque dans un environnement de formation contrôlé. L'application reste parfaitement sécurisée quand `LAB_MODE` est absent ou différent de `'true'`.

---

## 2. Règles transverses (non négociables)

### R-LAB-1 — Interrupteur unique et immuable
`LAB_MODE` est une variable d'environnement lue une seule fois au démarrage du processus Node. Elle n'est jamais stockée en base, exposée via API, modifiable depuis l'interface, ni activée par `lab_scenarios.enabled` (ce champ est réservé au suivi pédagogique).

### R-LAB-2 — Isolation totale du code vulnérable
Tout le code vulnérable est dans `src/lab/`, importé dans `AppModule` uniquement si `process.env.LAB_MODE === 'true'`. Quand `LAB_MODE !== 'true'` : aucune route de lab n'existe dans le routeur, aucun code vulnérable n'est chargé, les routes de production ne sont pas modifiées.

### R-LAB-3 — Deux catégories de failles

**Failles intra-flux** — guards RBAC de production intacts, faille dans la logique métier après autorisation :

| Scénario | Route | Mécanisme |
|---|---|---|
| WEB-01 | `GET /api/v1/employees/search` | Nouvelle route, SQL brut non paramétré |
| WEB-02 | `GET /api/v1/documents/:id/download` | Surcharge, suppression de `findVisibleDocument` |
| WEB-04 | `GET/POST /api/v1/documents/:id/comments` | Nouvelle route, rendu HTML brut |
| WEB-05 | `POST /api/v1/documents/upload` | Surcharge, suppression de la vérification de signature |
| WEB-07 | `PATCH /api/v1/employees/:id` | Surcharge, DTO vulnérable acceptant `positionId`/`departmentId` |

**Failles avec endpoint de lab dédié** — nouvel endpoint `/api/v1/lab/...`, guard affaibli ou absent :

| Scénario | Route de lab | Nature |
|---|---|---|
| WEB-03 | `POST /api/v1/lab/admin/users/:id/role` | `@Public()`, pas de garde RBAC |
| WEB-06 | Modifie `POST /api/v1/auth/login` | Header `X-Session-Fix` accepté |
| WEB-08 | `POST /api/v1/lab/documents/:id/convert` | Command injection confinée |

### R-LAB-4 — Logs propres
Les logs de lab contiennent uniquement `{ scenarioCode, actorId, sourceIp, timestamp, result }`. Jamais de données exfiltrées, de hash, de tokens, ni de secrets.

### R-LAB-5 — Aucune action destructrice
Même sous `LAB_MODE=true` : aucune suppression irréversible, aucune corruption des données de production.

### R-LAB-6 — Documentation README
Le `README.md` du backend contient un avertissement :
> **⚠️ LAB_MODE** — Ne jamais activer sur un déploiement exposé à un réseau réel. Réservé aux environnements de formation isolés.

### R-LAB-7 — Double preuve obligatoire par scénario
1. Preuve d'exploitation : `LAB_MODE=true` + commande curl reproductible.
2. Preuve de blocage : `LAB_MODE=false` → 404 ou comportement sécurisé de production.

---

## 3. Catalogue des 8 scénarios WEB

### WEB-01 — SQL Injection
- **Route** : `GET /api/v1/employees/search?q=<payload>` (n'existe pas en production)
- **MITRE** : T1190
- **Mécanisme** : `prisma.$queryRawUnsafe()` avec concaténation directe de `q`
- **Payload** : `' UNION SELECT id, username, email, "passwordHash", NULL, NULL, NULL, NULL FROM users --`
- **Résultat** : colonnes `id`, `username`, `email`, `passwordHash` (hash argon2) de `users` — jamais le mot de passe en clair, le hash est le pivot SQLi → craquage offline
- **Blocage** : route absente → 404

### WEB-02 — IDOR
- **Route** : `GET /api/v1/documents/:id/download` (route existante, surchargeée)
- **MITRE** : T1530
- **Mécanisme** : `findUnique` direct au lieu de `findVisibleDocument` (qui applique M9)
- **Résultat** : un EMPLOYEE du département CF télécharge un document RESTRICTED du département DG via UUID
- **Blocage** : `findVisibleDocument` applique M9 → 404

### WEB-03 — Broken Access Control
- **Route** : `POST /api/v1/lab/admin/users/:id/role` (endpoint de lab, `@Public()`)
- **MITRE** : T1078
- **Corps** : `{ roleName: "SUPER_ADMIN" }`
- **Résultat** : n'importe qui (sans session) élève un compte à SUPER_ADMIN
- **Blocage** : route absente → 404

### WEB-04 — Stored XSS
- **Routes** : `POST /api/v1/documents/:id/comments` + `GET /api/v1/documents/:id/comments`
- **MITRE** : T1059.007
- **Modèle** : `DocumentComment` (migration permanente — voir §4)
- **Mécanisme** : `content` stocké et retourné sans encodage sous `LAB_MODE=true` ; encodé (`&lt;script&gt;`) sous `LAB_MODE=false`
- **Résultat** : `<script>alert('XSS')</script>` retourné brut dans la réponse JSON
- **Blocage** : `content` est encodé HTML

### WEB-05 — Unrestricted File Upload
- **Route** : `POST /api/v1/documents/upload` (route existante, surchargeée)
- **MITRE** : T1608.001
- **Mécanisme** : suppression de `detectAllowedFileType`, suppression de `MAX_FILE_SIZE`, `Content-Type` réel retourné au téléchargement
- **Résultat** : upload de `shell.php` → téléchargement avec `Content-Type: application/x-php`
- **Blocage** : `detectAllowedFileType` bloque → 400

### WEB-06 — Session Fixation
- **Route** : `POST /api/v1/auth/login` (comportement modifié sous `LAB_MODE=true`)
- **MITRE** : T1563
- **Mécanisme** : header `X-Session-Fix: <token>` utilisé comme jeton de session au lieu de `randomBytes(48)`
- **Résultat** : attaquant rejoue le token fixé après que la victime s'est connectée
- **Blocage** : header ignoré, `randomBytes(48)` toujours utilisé

### WEB-07 — Mass Assignment
- **Route** : `PATCH /api/v1/employees/:id` (route existante, surchargeée)
- **MITRE** : T1565.001
- **Mécanisme** : `LabUpdateEmployeeDto` accepte `positionId` et `departmentId` sans restriction de scope
- **Résultat** : un EMPLOYEE modifie son propre `positionId` et `departmentId`
- **Blocage** : DTO de production + `whitelist: true` rejettent ces champs

### WEB-08 — Command Injection
- **Route** : `POST /api/v1/lab/documents/:id/convert` (endpoint de lab uniquement)
- **MITRE** : T1059.003
- **Environnement** : Windows Server 2022
- **Mécanisme** : `spawn('cmd.exe', ['/c', 'convert --format ' + format + ' NUL'])` — `format` non échappé
- **Confinement** :
  - `spawn` uniquement (jamais `exec`)
  - CWD : `C:\gfep-lab-scratch\` (créé au démarrage si absent)
  - Env : `{ PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }` uniquement
  - Timeout : 5 s, `killSignal: 'SIGKILL'`
  - Sortie limitée à 4 KB
- **Résultat** : `format=pdf& whoami` → sortie de `whoami` dans la réponse
- **Commandes démo** : `whoami`, `dir`, `type C:\Windows\System32\drivers\etc\hosts`
- **Blocage** : route absente → 404

---

## 4. Modèle DocumentComment (WEB-04)

Migration permanente (la table existe toujours ; le rendu brut est contrôlé par `LAB_MODE`) :

```prisma
model DocumentComment {
  id         String   @id @default(uuid())
  documentId String
  authorId   String
  content    String
  createdAt  DateTime @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@map("document_comments")
}
```

Relation inverse dans `Document` : `comments DocumentComment[]`.

---

## 5. Tables lab_scenarios et scenario_executions

Déjà dans `schema.prisma`. Un seed de lab distinct (`prisma/seed-lab.ts`) insère les 8 scénarios avec `enabled=false`. L'activation se fait par `UPDATE` SQL direct en base — jamais depuis l'interface.
