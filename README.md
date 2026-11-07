# GFEP — Guinea Financial Employee Platform

> Plateforme interne de gestion documentaire et RH pour **Guinea Financial** (groupe bancaire guinéen).  
> Projet de soutenance cybersécurité — démonstration de 8 vulnérabilités web chaînées jusqu'au pivot Active Directory.

---

## 🎯 Objectif du projet

GFEP est une application web interne (monorepo TypeScript) qui couvre :

- **Annuaire employés** (consultation, recherche, profil)
- **Gestion documentaire** (upload, partage, commentaires, conversion)
- **Contrôle d'accès RBAC** (8 rôles, permissions granulaires)
- **Audit et conformité** (journal immuable, événements de sécurité)
- **Finance** (factures, transactions — lecture seule selon rôle)

Ce dépôt contient **deux versions** :

| Branche | Usage |
|---|---|
| `main` (tag `v-mvp3-clean`) | **Version saine**, sans vulnérabilités — pour la production |
| `vulnerable/web-01` | **Version pédagogique** avec 8 vulnérabilités injectées — pour la démo de soutenance |

---

## 🏗️ Architecture

```
gfep/                          # monorepo npm workspaces
├── apps/
│   ├── backend/               # NestJS 12 + TypeScript + Prisma
│   │   ├── src/               # code source
│   │   ├── prisma/            # schéma + migrations + seed
│   │   ├── test/              # tests d'intégration (*.int-spec.ts)
│   │   └── dist/              # build compilé (généré)
│   └── frontend/              # Next.js 15 + TypeScript + Tailwind + shadcn/ui
│       ├── src/               # pages et composants
│       └── .next/             # build Next.js (généré)
├── docker-compose.yml         # PostgreSQL 16 (conteneur)
├── package.json               # workspaces + scripts racine
└── README.md                  # ce fichier
```

**Flux réseau local (dev) :**

```
Navigateur
   │  :3000
   ▼
Next.js (frontend)
   │  fetch /api/v1/*
   ▼
NestJS (backend) :3001
   │  Prisma
   ▼
PostgreSQL :5432 (docker compose)
```

**Flux réseau en production (WEB01 — Windows Server 2022) :**

```
Client
   │  :443 (HTTPS)
   ▼
IIS + ARR (reverse proxy)
   │  :3000 (frontend Next.js) + :3001 (backend NestJS)
   ▼
Node.js 24 (processus Windows Service)
   │
   ▼
PostgreSQL (locale ou distante)
```

---

## 🧰 Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Frontend | Next.js + React + TypeScript | 15.5 |
| UI | Tailwind CSS + shadcn/ui | latest |
| Backend | NestJS + TypeScript | 12 |
| ORM | Prisma | 6.x |
| Base de données | PostgreSQL | 16 |
| Auth | Sessions serveur (cookie httpOnly) + argon2 | — |
| Tests | Vitest | 2.x |
| Runtime | Node.js | ≥ 20 (24 en prod) |
| Conteneurisation (dev) | Docker / Podman Compose | — |

---

## ✅ Prérequis

### Développement local (Linux — Parrot / Debian / Ubuntu)

| Outil | Version minimale | Commande de vérification |
|---|---|---|
| Node.js | 20 | `node --version` |
| npm | 10 | `npm --version` |
| Git | 2.30 | `git --version` |
| Docker (ou Podman) | 24 | `docker --version` |
| Docker Compose | v2 | `docker compose version` |
| PostgreSQL client (optionnel) | 16 | `psql --version` |

### Serveur WEB01 (Windows Server 2022)

**Déjà installé sur WEB01 (à vérifier) :**

- ✅ Docker Desktop (ou Docker Engine)
- ✅ Node.js 24
- ✅ npm
- ✅ IIS

**À installer sur WEB01 (à faire) :**

- ❌ **IIS Application Request Routing (ARR)** — module d'IIS pour le reverse proxy
- ❌ **IIS URL Rewrite** — dépendance d'ARR
- ❌ **git** — pour cloner le repo
- ❌ **PostgreSQL 16** — OU accès réseau à un PostgreSQL existant (voir section Déploiement)
- ❌ **NSSM** (Non-Sucking Service Manager) — pour faire tourner Node en Windows Service (optionnel mais recommandé)

**Commandes PowerShell (à lancer en admin sur WEB01) :**

```powershell
# 1. Vérifier les prérequis déjà présents
node --version
npm --version
docker --version
git --version

# 2. Installer IIS URL Rewrite + ARR
# Télécharger et installer :
#   - URL Rewrite :      https://www.iis.net/downloads/microsoft/url-rewrite
#   - ARR :              https://www.iis.net/downloads/microsoft/application-request-routing
#   (ou via Chocolatey : choco install urlrewrite arr)

# 3. Installer git si absent
winget install --id Git.Git -e

# 4. Installer NSSM (optionnel)
winget install --id NSSM.NSSM -e
```

---

## 🚀 Installation locale (dev — Linux)

### 1. Cloner le dépôt

```bash
git clone <URL_DU_REPO> ~/Elitech/Projet/gfep
cd ~/Elitech/Projet/gfep
```

### 2. Installer les dépendances (monorepo)

```bash
npm install
```

Le `npm install` à la racine installe les workspaces (`apps/backend` + `apps/frontend`).

### 3. Configurer les variables d'environnement

**`.env` à la racine** (utilisé par Docker Compose pour PostgreSQL) :

```env
POSTGRES_USER=gfep_user
POSTGRES_PASSWORD=<mot_de_passe_fort>
POSTGRES_DB=gfep_db
```

**`apps/backend/.env`** (utilisé par NestJS + Prisma) :

```env
DATABASE_URL="postgresql://gfep_user:<mot_de_passe>@localhost:5432/gfep_db"
PORT=3001
SESSION_COOKIE_NAME=gfep_session
```

**`apps/frontend/.env.local`** :

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

⚠️ **Ne jamais committer les `.env`** — ils sont dans `.gitignore`.

### 4. Démarrer PostgreSQL

```bash
docker compose up -d postgres
docker compose ps              # doit afficher "Up" pour postgres
```

### 5. Appliquer les migrations Prisma

```bash
cd apps/backend
npx prisma migrate deploy
```

### 6. Seeder la base (comptes + données de démo)

```bash
cd apps/backend
npm run prisma:seed            # ou : npx prisma db seed
```

⚠️ Le seed **refuse de s'exécuter en production** (`assertNotProduction`). Il nécessite `NODE_ENV != production`.

---

## 🏃 Lancement local (dev)

### Backend (NestJS)

```bash
cd apps/backend
npm run build                  # compile TypeScript → dist/
npm run start:prod             # démarre sur :3001
# ou en mode watch :
npm run start:dev
```

Vérifier : `curl http://localhost:3001/api/v1/health` → `{"status":"ok"}`

### Frontend (Next.js)

```bash
cd apps/frontend
npm run dev                    # démarre sur :3000 (Turbopack)
# ou en prod :
npm run build && npm run start
```

Ouvrir : `http://localhost:3000`

---

## 👥 Comptes seedés (⚠️ démo uniquement)

Les mots de passe par défaut sont définis dans `apps/backend/prisma/seed-lib.ts` et sont **prévisibles** (`GF_<Rôle>2026!`). **Ils ne doivent JAMAIS être utilisés en production.**

| Rôle | Username | Email | Mot de passe seed |
|---|---|---|---|
| SUPER_ADMIN | `t.balde` | t.balde@guineasf.com | `GF_Admin2026!` |
| HR_MANAGER | `f.camara` | f.camara@guineasf.com | `GF_Hr2026!` |
| IT_ADMINISTRATOR | `m.keita` | m.keita@guineasf.com | `GF_ItAdmin2026!` |
| IT_TECHNICIAN | `f.kaba` | f.kaba@guineasf.com | `GF_ItTech2026!` |
| DEPARTMENT_MANAGER | `a.barry` | a.barry@guineasf.com | `GF_Mgr2026!` |
| ACCOUNTANT | `ibrahima.sow` | ibrahima.sow@guineasf.com | `GF_Acc2026!` |
| AUDITOR | `s.toure` | s.toure@guineasf.com | `GF_Audit2026!` |
| EMPLOYEE | `a.cisse` | a.cisse@guineasf.com | `GF_Emp2026!` |

**34 comptes EMPLOYEE** supplémentaires sont seedés.

---

## 🔑 Variables d'environnement (référence)

### Backend (`apps/backend/.env`)

| Clé | Description | Exemple |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL Prisma | `postgresql://gfep_user:***@localhost:5432/gfep_db` |
| `PORT` | Port du backend NestJS | `3001` |
| `SESSION_COOKIE_NAME` | Nom du cookie de session | `gfep_session` |
| `NODE_ENV` | `development` / `production` | `development` |

### Frontend (`apps/frontend/.env.local`)

| Clé | Description | Exemple |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL de base de l'API | `http://localhost:3001/api/v1` |

---

## 🖥️ Déploiement sur WEB01 (Windows Server 2022)

**Contexte :** WEB01 est un Windows Server 2022 joint au domaine `gnpaytrust.local`. Il héberge le backend, le frontend et la base de données GFEP. IIS sert de reverse proxy HTTPS devant Node.

**Prérequis sur WEB01 :** Node.js 24, npm, Docker, IIS, ARR, URL Rewrite, git, PostgreSQL 16 (ou accès à un PostgreSQL distant).

### 1. Cloner le dépôt

```powershell
git clone <URL_DU_REPO> C:\gfep
cd C:\gfep
git checkout vulnerable/web-01   # ou main pour la version saine
```

### 2. Installer les dépendances

```powershell
npm install
```

### 3. Démarrer PostgreSQL

Deux options :

**Option A — PostgreSQL local sur WEB01**

```powershell
# Installer PostgreSQL 16 (winget)
winget install --id PostgreSQL.PostgreSQL.16 -e

# Créer la base et l'utilisateur (via pgAdmin ou psql)
psql -U postgres -c "CREATE USER gfep_user WITH PASSWORD '<mot_de_passe_fort>';"
psql -U postgres -c "CREATE DATABASE gfep_db OWNER gfep_user;"
```

**Option B — PostgreSQL distant (sur une autre machine du réseau)**

Modifier `apps/backend/.env` :

```env
DATABASE_URL="postgresql://gfep_user:<mot_de_passe>@<IP_DB>:5432/gfep_db"
```

S'assurer que le PostgreSQL distant accepte les connexions depuis l'IP de WEB01 (`pg_hba.conf`).

### 4. Configurer les `.env`

Reproduire les fichiers de la section « Installation locale » avec les **valeurs de production** (mots de passe forts, `NODE_ENV=production`).

### 5. Appliquer les migrations et seeder

```powershell
cd C:\gfep\apps\backend
npx prisma migrate deploy
# Seeder : UNIQUEMENT en environnement de démo (pas en prod réelle)
$env:NODE_ENV = "development"
npx prisma db seed
```

### 6. Compiler et lancer le backend

```powershell
cd C:\gfep\apps\backend
npm run build
node dist\main.js
```

Le backend écoute sur `http://localhost:3001`.

### 7. Compiler et lancer le frontend

```powershell
cd C:\gfep\apps\frontend
npm run build
npm run start
```

Le frontend écoute sur `http://localhost:3000`.

### 8. (Recommandé) Enregistrer backend et frontend comme services Windows

Avec **NSSM** :

```powershell
nssm install GFEP-Backend "C:\Program Files\nodejs\node.exe" "C:\gfep\apps\backend\dist\main.js"
nssm set GFEP-Backend AppDirectory "C:\gfep\apps\backend"
nssm set GFEP-Backend AppEnvironmentExtra "NODE_ENV=production"
nssm start GFEP-Backend

nssm install GFEP-Frontend "C:\Program Files\nodejs\npm.cmd" "run start"
nssm set GFEP-Frontend AppDirectory "C:\gfep\apps\frontend"
nssm start GFEP-Frontend
```

### 9. Configurer IIS + ARR (reverse proxy)

**Créer un site IIS** qui pointe vers `C:\inetpub\gfep-proxy` (dossier vide, le routage se fait par URL Rewrite).

**Ajouter un `web.config` :**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- API backend -->
        <rule name="API to NestJS" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3001/api/{R:1}" />
        </rule>
        <!-- Frontend Next.js -->
        <rule name="Frontend to Next.js" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <proxy enabled="true" preserveHostHeader="true" />
  </system.webServer>
</configuration>
```

**Activer ARR :** IIS Manager → nœud serveur → **Application Request Routing Cache** → **Server Proxy Settings** → cocher **Enable proxy**.

### 10. Vérifier le déploiement

Depuis un navigateur ou `curl` :

```powershell
curl http://localhost/api/v1/health
# → {"status":"ok","timestamp":"..."}
```

---

## 🧪 Tests

### Backend (Vitest — tests d'intégration)

```bash
cd apps/backend
npm test                      # tous les tests
npm test -- employees           # tests ciblés
```

Les tests d'intégration sont dans `apps/backend/test/*.int-spec.ts` et nécessitent une DB PostgreSQL active.

### Frontend (Vitest — composants)

```bash
cd apps/frontend
npm test
```

---

## 🔐 Sécurité & labo

⚠️ **La branche `vulnerable/web-01` contient 8 vulnérabilités pédagogiques.** Elle est destinée **exclusivement** à la démonstration de soutenance et ne doit **jamais** être déployée en production.

| ID | Vulnérabilité | Endpoint | Type |
|---|---|---|---|
| WEB-01 | SQL Injection | `GET /api/v1/employees/search` | Injection |
| WEB-02 | IDOR (documents RESTRICTED) | `GET /api/v1/documents/:id/download` | Contrôle d'accès |
| WEB-03 | Broken Access Control | `PUT /api/v1/access/users/:id/self-assign-role` | Escalade de privilèges |
| WEB-04 | Stored XSS | `POST /api/v1/documents/:id/comments` | XSS |
| WEB-05 | Upload non sécurisé | `POST /api/v1/documents` | Upload |
| WEB-06 | Session Fixation | `POST /api/v1/auth/login` | Session |
| WEB-07 | Mass Assignment | `PATCH /api/v1/profile/employee` | Contrôle d'accès |
| WEB-08 | Command Injection | `POST /api/v1/documents/:id/convert` | RCE |

**Scénario de démonstration :** compromission compte EMPLOYEE → WEB-01 (dump) → WEB-03 (élévation SUPER_ADMIN) → WEB-02 (exfiltration docs RESTRICTED) → WEB-08 (RCE WEB01) → pivot vers DC01 (`gnpaytrust.local`, AS-REP `j.konate`, Kerberoasting `svc-webapp`, GenericAll OU Comptabilité).

**Comparaison saine/vulnérable :** basculer entre `main` (tag `v-mvp3-clean`) et `vulnerable/web-01` pour démontrer l'impact des correctifs.

---

## 🛠️ Troubleshooting

### `docker compose ps` affiche `5432/tcp` sans mapping

Sous **podman-compose**, la colonne `PORTS` est parfois vide alors que le port est bien exposé. Vérifier avec :

```bash
timeout 3 bash -c '</dev/tcp/127.0.0.1/5432' && echo "PORT OUVERT" || echo "PORT FERMÉ"
```

### `FATAL: role "postgres" does not exist`

L'utilisateur PostgreSQL par défaut n'est pas `postgres`. Utiliser `gfep_user` (défini dans `.env`) :

```bash
docker compose exec -T postgres psql -U gfep_user -d gfep_db -c "\dt"
```

### `relation "User" does not exist`

Prisma mappe les tables en snake_case (`users`) et les colonnes en camelCase (`"roleId"`, `"userId"`). Toujours quoter les colonnes camelCase en SQL direct.

### Login → `HTTP 400 "Données invalides. fields: [username]"`

La route `POST /auth/login` attend le champ **`username`**, pas `email` :

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"a.cisse","password":"***"}'
```

### Login → `HTTP 429 Too Many Requests`

Rate-limit : **5 tentatives / 5 minutes**. Attendre le reset (`X-RateLimit-Reset-login` dans la réponse) ou redémarrer le backend en dev.

### `sqlmap` détecte un faux WAF

`sqlmap` signale parfois `heuristics detected that the target is protected by some kind of WAF/IPS` à cause de la validation NestJS (400 sur certains payloads). Ce n'est pas un WAF réel. Utiliser `--technique=BT --tamper=space2comment --random-agent` pour contourner.

### Backend démarre mais 500 au premier appel Prisma

Vérifier que les migrations sont appliquées (`npx prisma migrate deploy`) et que `DATABASE_URL` pointe vers la bonne DB.

### WEB01 — IIS retourne 502 Bad Gateway

Vérifier que les processus Node tournent (`netstat -ano | findstr :3001` et `:3000`), et que **ARR proxy** est activé dans IIS Manager.

---

## 📚 Ressources

- [Documentation NestJS](https://docs.nestjs.com/)
- [Documentation Next.js 15](https://nextjs.org/docs)
- [Documentation Prisma](https://www.prisma.io/docs)
- [OWASP Top 10](https://owasp.org/Top10/)
- [Verizon DBIR 2024](https://www.verizon.com/business/resources/reports/dbir/) — statistiques sur les menaces internes et les compromissions de credentials

---

## 📄 Licence

Projet pédagogique — **usage interne uniquement**. La branche `vulnerable/web-01` est fournie **à des fins de formation en cybersécurité** et ne doit pas être exposée sur Internet.
