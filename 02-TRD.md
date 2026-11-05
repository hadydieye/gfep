# TRD — Guinea Finance Enterprise Portal (GFEP)
### Technical Requirements Document
Projet parent : Enterprise Breach
Version 1.0 — 2026-11-05

---

## 1. Objet

Ce document définit les exigences techniques de GFEP : stack, architecture, contraintes non fonctionnelles, sécurité, intégrations. Il complète le PRD (exigences produit) et précède le Backend Schema et l'Implementation Plan.

## 2. Stack technique

| Couche | Technologie | Version cible |
| --- | --- | --- |
| Frontend | Next.js (App Router) + TypeScript | Next.js 15+ |
| Styling | Tailwind CSS + shadcn/ui | — |
| Backend | NestJS + TypeScript | NestJS 10+ |
| Base de données | PostgreSQL | 16+ |
| ORM | Prisma | 5+ |
| Authentification | Sessions serveur (cookie httpOnly) + intégration LDAPS pour AD | — |
| Validation | class-validator / class-transformer (backend), Zod (frontend) | — |
| Formulaires | React Hook Form | — |
| Graphiques | Recharts | — |
| Icônes | Lucide Icons | — |
| Documentation API | Swagger / OpenAPI | — |
| Tests | Jest + Supertest (backend), Playwright ou Vitest (frontend) | — |
| Logs | Pino (structuré, JSON) | — |

## 3. Architecture générale

```
[ Navigateur ]
      |
      | HTTPS
      v
[ Next.js — frontend ]
      |
      | REST API (HTTPS, cookie de session)
      v
[ NestJS — backend ]
   |        |         |
   v        v         v
[ PostgreSQL ]  [ Service LDAPS ]  [ Service de logs structurés ]
                      |                     |
                      v                     v
              [ Active Directory ]   [ Dispositif de supervision ]
```

**Règles d'architecture non négociables** :
1. Le frontend ne communique **jamais** directement avec PostgreSQL ni avec Active Directory. Toute donnée transite par l'API NestJS.
2. NestJS est l'unique couche d'accès aux données métier (via Prisma).
3. Les communications avec Active Directory passent par un service d'intégration dédié (`AdAuthModule`), jamais appelé directement depuis un contrôleur.
4. Chaque opération sensible (définie en section 7) génère un événement de log structuré, écrit de façon asynchrone pour ne jamais bloquer la réponse à l'utilisateur.

## 4. Environnements

| Environnement | Usage | Particularité |
| --- | --- | --- |
| `development` | Développement local | Base de données locale, hot-reload |
| `secure` | Mode sécurisé (production simulée) | Toutes les validations actives, aucune vulnérabilité accessible |
| `lab` | Mode laboratoire | Vulnérabilités pédagogiques activables individuellement |

La bascule entre `secure` et `lab` se fait via une variable d'environnement (`APP_MODE`), qui conditionne le **chargement de modules de routes distincts** au démarrage de l'application — jamais une condition `if` dans le code métier partagé. Un module de routes "lab" ne doit jamais être importé dans le bundle de production.

## 5. Exigences non fonctionnelles

| Catégorie | Exigence |
| --- | --- |
| Performance | Temps de réponse API < 300ms pour 95% des requêtes CRUD simples, avec le jeu de données de test |
| Disponibilité | N/A (environnement de laboratoire, pas de SLA de production) |
| Sécurité transport | HTTPS obligatoire sur toutes les communications frontend↔backend et backend↔AD (LDAPS, jamais LDAP en clair) |
| Scalabilité | Non prioritaire (laboratoire mono-instance) ; l'architecture reste néanmoins stateless côté API hormis les sessions en base |
| Journalisation | Logs structurés JSON, aucune donnée sensible (mot de passe, token, secret) en clair dans un log |
| Internationalisation | Interface en français uniquement pour cette version |
| Accessibilité | Niveau WCAG AA raisonnable sur les parcours principaux (contraste, labels, navigation clavier) |

## 6. Exigences de sécurité (mode sécurisé)

- Mots de passe hashés avec `argon2` (jamais md5/sha1/sha256 nu).
- Sessions : cookie `httpOnly`, `secure`, `sameSite=strict` ; token de session stocké hashé en base, jamais en clair.
- Rate limiting sur `/auth/login` et `/auth/login-ad` : 5 tentatives / 15 min / IP.
- Toutes les entrées utilisateur validées côté backend avec DTO stricts (`whitelist: true`, rejet des champs non déclarés).
- Toute requête SQL passe par Prisma (requêtes paramétrées) — aucune requête brute en mode sécurisé.
- RBAC vérifié côté serveur sur chaque endpoint sensible, jamais uniquement côté interface.
- OWASP Top 10 comme référentiel de revue de sécurité pour le mode sécurisé.
- Aucun secret (clé API, mot de passe, chaîne de connexion) en dur dans le code — variables d'environnement uniquement.

## 7. Opérations sensibles à journaliser

| Catégorie | Événements |
| --- | --- |
| Authentification | Connexion réussie/échouée (locale et AD), déconnexion, verrouillage de compte |
| Comptes et rôles | Création/modification/suspension de compte, attribution/retrait de rôle |
| Documents | Consultation, téléchargement, suppression d'un document classé confidentiel |
| Finance | Création/modification d'une transaction ou facture |
| Administration | Modification d'un paramètre système, modification d'une permission |

Chaque événement suit le format structuré suivant (exemple) :

```json
{
  "event": "authentication_failed",
  "actorId": "uuid-ou-null",
  "username": "m.diallo",
  "authMethod": "LOCAL",
  "sourceIp": "192.168.50.12",
  "timestamp": "2026-11-05T10:00:00Z",
  "status": "failed",
  "reason": "invalid_credentials"
}
```

## 8. Intégration Active Directory — exigences techniques

- Protocole : LDAPS (port 636) exclusivement, jamais LDAP en clair (389).
- Bibliothèque : `ldapjs`.
- Deux comptes de service distincts : un compte en lecture seule dédié aux recherches LDAP (`svc-ldapreader`), un compte applicatif distinct pour tout usage futur nécessitant plus de droits — jamais le même compte pour les deux usages.
- L'application ne stocke **jamais** de mot de passe Active Directory, ni en clair ni hashé.
- Mapping groupe AD → rôle applicatif via une table de correspondance explicite (pas de logique codée en dur), modifiable sans redéploiement.
- Timeout de connexion LDAPS fixé à 3 secondes ; en cas d'échec ou de panne, refus explicite de l'accès (jamais de fallback silencieux vers un accès non vérifié).

## 9. API REST — exigences générales

- Toutes les routes sous `/api/v1`, versionnées.
- Documentation Swagger générée automatiquement et tenue à jour à chaque endpoint ajouté.
- Chaque DTO d'entrée validé avec `class-validator`, `whitelist: true`, `forbidNonWhitelisted: true`.
- Réponses d'erreur standardisées (code, message générique côté client, détail technique uniquement dans les logs serveur).
- Pagination obligatoire sur tous les endpoints de liste (`?page=&limit=`), limite par défaut raisonnable (ex: 25).

## 10. Déploiement (contexte laboratoire)

- Application hébergée sur WEB01 (Windows Server 2022, membre du domaine), services backend/frontend/PostgreSQL colocalisés dans le périmètre du laboratoire.
- Reverse proxy IIS ou Nginx devant le frontend/backend, HTTPS avec certificat auto-signé acceptable pour le laboratoire.
- Les ports d'administration de PostgreSQL ne sont jamais exposés au-delà de `localhost` sur WEB01.

## 11. Observabilité

- Les logs applicatifs structurés sont écrits en local puis transmis à l'agent de supervision installé sur WEB01 (hors périmètre technique de ce document, voir documents Enterprise Breach).
- Chaque requête HTTP entrante reçoit un identifiant de corrélation (`requestId`), propagé dans tous les logs liés à cette requête.

## 12. Dette technique acceptée (explicite)

Pour rester réalisable dans le temps du projet, les éléments suivants sont volontairement simplifiés et documentés comme tels (pas un oubli) :
- Pas de file d'attente asynchrone dédiée (ex: Redis/BullMQ) pour les notifications — traitement synchrone acceptable à cette échelle.
- Pas de CDN ni de cache applicatif distribué — non pertinent pour ~40 utilisateurs fictifs.
- Pas de haute disponibilité (un seul serveur applicatif, une seule base) — hors périmètre d'un laboratoire pédagogique.
