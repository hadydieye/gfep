# Implementation Plan — Guinea Finance Enterprise Portal (GFEP)
### Plan d'implémentation pour agent de développement IA
Version 1.0 — 2026-11-05

---

## 1. Objet

Ce document donne l'ordre exact de construction du projet, étape par étape, pour un agent de développement autonome (Claude Code ou équivalent). Chaque étape précise : ce qu'il faut construire, à partir de quel document de référence, et le critère qui permet de passer à l'étape suivante. **Ne pas sauter d'étape, ne pas paralléliser au-delà de ce qui est indiqué.**

Documents de référence à utiliser en continu :
- `01-PRD.md` — exigences produit et UX
- `02-TRD.md` — exigences techniques et architecture
- `03-AppFlow.md` — écrans et navigation
- `04-UXUI-Design-System.md` — règles visuelles
- `05-Backend-Schema.md` — schéma de données et flux d'authentification

## 2. Principe général

Construire **un module fonctionnel complet** (base de données → API → interface) avant de passer au suivant. Ne jamais commencer un nouveau module tant que le précédent n'est pas testé et fonctionnel. Trois vagues (MVP) structurent le travail.

---

## PHASE 0 — Fondations

### Étape 0.1 — Initialisation des projets
- Créer un monorepo (ou deux dépôts, selon préférence) avec `apps/frontend` (Next.js + TypeScript) et `apps/backend` (NestJS + TypeScript).
- Installer et configurer Tailwind CSS + shadcn/ui dans le frontend (voir `04-UXUI-Design-System.md` pour les tokens de thème à définir dès cette étape, pas plus tard).
- Configurer ESLint, Prettier, et les scripts de build/dev pour les deux projets.
- **Critère de passage** : `npm run dev` démarre sans erreur sur le frontend (page d'accueil par défaut) et sur le backend (endpoint de santé `/api/v1/health` répond 200).

### Étape 0.2 — Base de données et Prisma
- Installer Prisma dans le backend, configurer la connexion PostgreSQL.
- Copier intégralement le schéma de `05-Backend-Schema.md` section 3 dans `schema.prisma`.
- Générer et exécuter la première migration.
- **Critère de passage** : `prisma migrate dev` réussit, toutes les tables sont visibles en base, `prisma studio` permet de les parcourir.

### Étape 0.3 — Thème et design system en code
- Définir les tokens de couleur (section 2.1 de `04-UXUI-Design-System.md`) dans la configuration Tailwind (mode clair + mode sombre).
- Charger la police retenue via `next/font`.
- Personnaliser au moins les composants shadcn/ui suivants avant toute utilisation : Button, Card, Table, Input, Badge, Toast — jamais utilisés avec leur thème par défaut non modifié.
- **Critère de passage** : une page de test affiche ces composants personnalisés en mode clair et sombre, conforme à la section 2 de `04-UXUI-Design-System.md`.

---

## PHASE MVP 1 — Socle fonctionnel

### Étape 1.1 — Authentification locale
- Implémenter le flux décrit en `05-Backend-Schema.md` section 5.1 (inscription non requise — les comptes sont créés par seed/admin, pas d'auto-inscription).
- Endpoints : `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- Hash des mots de passe avec `argon2` (voir `02-TRD.md` section 6).
- Rate limiting 5 tentatives / 15 min (voir `02-TRD.md` section 6).
- Frontend : écrans `/login` (voir `03-AppFlow.md` section 3.1), gestion du cookie de session, redirection post-connexion.
- **Critère de passage** : connexion/déconnexion fonctionnelles avec un utilisateur de test créé manuellement en base ; un échec de connexion affiche le message générique attendu ; 5 échecs verrouillent le compte.

### Étape 1.2 — RBAC basique (3 rôles)
- Implémenter `Role`, `Permission`, `UserRole`, `RolePermission` côté backend (déjà dans le schéma).
- Créer 3 rôles de départ : `SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `EMPLOYEE` (les 5 rôles restants arrivent en Phase MVP 2, étape 2.4).
- Guard NestJS de rôle (`@Roles()`) et guard de permission granulaire (`@Permission()`), comme décrit en `02-TRD.md` section 6 et `05-Backend-Schema.md` section 5.4.
- **Critère de passage** : un endpoint protégé de test retourne 200 pour le rôle autorisé et 403 pour les autres, vérifié pour les 3 rôles.

### Étape 1.3 — Module Dashboard (version simplifiée)
- Endpoint backend retournant les indicateurs de base (nombre d'employés, activités récentes vides pour l'instant).
- Écran `/dashboard` (voir `03-AppFlow.md` section 3.3 et section 5), avec contenu adapté selon le rôle des 3 rôles existants.
- **Critère de passage** : le dashboard affiche des données réelles issues de la base, différentes selon le rôle connecté.

### Étape 1.4 — Module Employés (CRUD complet)
- Backend : endpoints `/employees` (liste paginée, détail, création, modification) conformes à `05-Backend-Schema.md`.
- Frontend : écrans `/employees`, `/employees/[id]`, `/employees/new`, `/employees/[id]/edit` (voir `03-AppFlow.md` section 3.4).
- Appliquer les règles de permission : lecture pour tous, écriture pour Department Manager (son département) et Super Admin.
- **Critère de passage** : CRUD complet fonctionnel et testé manuellement pour chaque rôle, conforme aux permissions définies.

### Étape 1.5 — Module Départements (lecture + gestion simple)
- Backend : endpoints `/departments` (liste, détail).
- Frontend : écrans `/departments`, `/departments/[id]` (voir `03-AppFlow.md` section 3.5).
- **Critère de passage** : les 6 départements sont visibles avec leur effectif réel (calculé depuis `employees`).

**Fin de MVP 1** : à ce stade, l'application est démontrable (connexion, dashboard, gestion employés/départements) avec un jeu de données minimal.

---

## PHASE MVP 2 — Corps du projet

### Étape 2.1 — Jeu de données complet (seed)
- Écrire le script de seed Prisma produisant la volumétrie définie en `05-Backend-Schema.md` section 7 (6 départements, 40 employés, etc.).
- **Critère de passage** : `prisma db seed` exécute sans erreur et peuple toutes les tables aux volumes prévus.

### Étape 2.2 — Module Documents
- Backend : endpoints `/documents` (liste, détail, upload, permissions), conformes au schéma `DocumentPermission`.
- Frontend : écrans `/documents`, `/documents/[id]`, `/documents/upload` (voir `03-AppFlow.md` section 3.6).
- Implémenter la vérification de permission fine décrite en `05-Backend-Schema.md` section 5.4 (pas seulement le rôle global).
- **Critère de passage** : un Employee ne voit que les documents de son département ou explicitement partagés ; test vérifié avec au moins deux comptes de départements différents.

### Étape 2.3 — Module Finance
- Backend : endpoints `/transactions`, `/invoices`.
- Frontend : écrans `/finance/transactions`, `/finance/invoices` et leurs sous-écrans (voir `03-AppFlow.md` section 3.7).
- **Critère de passage** : accès conforme à la matrice de rôles (Accountant plein accès, Department Manager lecture limitée, autres rôles sans accès au menu).

### Étape 2.4 — RBAC complet (8 rôles)
- Ajouter les 5 rôles restants : `IT_ADMINISTRATOR`, `IT_TECHNICIAN`, `HR_MANAGER`, `ACCOUNTANT`, `AUDITOR`.
- Créer les permissions associées (30 à 40 permissions au total, voir `05-Backend-Schema.md` section 7).
- Module `/access` (gestion des rôles et comptes) — voir `03-AppFlow.md` section 3.8.
- **Critère de passage** : chaque rôle a un comportement distinct et vérifié sur au moins un endpoint représentatif de chaque module déjà construit.

### Étape 2.5 — Notifications
- Backend : endpoint `/notifications`, génération d'une notification lors d'événements définis en `03-AppFlow.md` (ex: document partagé, changement de rôle).
- Frontend : écran `/notifications`, badge compteur dans la barre supérieure.
- **Critère de passage** : une action déclenchante (ex: partage de document) génère bien une notification visible par le destinataire.

### Étape 2.6 — Administration et audit (hors AD pour l'instant)
- Backend : `AuditLog` écrit automatiquement sur chaque action sensible listée en `02-TRD.md` section 7.
- Écran `/admin/audit` (lecture pour Auditor et Super Admin) — voir `03-AppFlow.md` section 3.10.
- **Critère de passage** : les actions des étapes précédentes (création employé, modification rôle, etc.) apparaissent bien dans le journal d'audit.

### Étape 2.7 — Authentification Active Directory
- Implémenter `AdAuthModule` avec `ldapjs`, selon le flux détaillé en `05-Backend-Schema.md` section 5.2.
- Nécessite que le domaine AD (hors périmètre de ce document applicatif) soit disponible pour les tests réels ; en attendant, prévoir un mode de test avec un serveur LDAP de développement (ex: conteneur `osixia/openldap`) pour valider le flux de code avant la connexion au vrai DC01.
- Créer la table `AdGroupRoleMapping` et son interface d'administration simple.
- **Critère de passage** : connexion réussie via un annuaire LDAP de test, avec mapping groupe → rôle fonctionnel ; refus propre si le serveur LDAP est injoignable (`AD_UNREACHABLE`).

**Fin de MVP 2** : application complète, intégrée à Active Directory, avec audit et notifications.

---

## PHASE MVP 3 — Finition design et volet sécurité

### Étape 3.1 — Passe de finition UI/UX complète
- Revue intégrale de tous les écrans construits dans les phases précédentes contre `04-UXUI-Design-System.md` (sections 3 à 8) : états vides, états de chargement, responsive, mode sombre.
- Corriger tout écart par rapport au design system avant de continuer.
- **Critère de passage** : chaque écran listé dans `03-AppFlow.md` existe, est responsive, et respecte la palette/typographie définies.

### Étape 3.2 — Profil utilisateur et paramètres
- Écran `/profile` (voir `03-AppFlow.md` section 3.11) : informations, changement de mot de passe (comptes locaux), bascule thème.
- Écran `/admin/settings` (Super Admin).
- **Critère de passage** : un utilisateur local peut changer son mot de passe ; la préférence de thème est persistée.

### Étape 3.3 — Durcissement sécurité (mode sécurisé)
- Appliquer systématiquement les exigences de `02-TRD.md` section 6 sur l'ensemble du code existant : requêtes paramétrées partout, DTO stricts partout, vérification serveur de toutes les autorisations, aucune donnée sensible en log.
- Mettre en place le flag `APP_MODE` et la séparation de modules décrite en `02-TRD.md` section 4 (préparation pour l'ajout ultérieur des scénarios pédagogiques, qui sont hors périmètre de ce document applicatif et traités dans les documents Enterprise Breach dédiés).
- **Critère de passage** : revue de code contre la checklist OWASP Top 10 sans écart identifié sur les modules livrés.

### Étape 3.4 — Tests automatisés
- Tests unitaires et d'intégration (Jest + Supertest) sur : flux d'authentification (local + AD mocké), guards RBAC, CRUD de chaque module.
- Tests frontend de base (rendu des écrans principaux, navigation).
- **Critère de passage** : suite de tests exécutable en CI, couverture raisonnable sur les services d'authentification et d'autorisation en particulier (zone la plus sensible).

### Étape 3.5 — Documentation API
- Générer la documentation Swagger/OpenAPI complète, accessible sur `/api/docs` en environnement de développement uniquement.
- **Critère de passage** : tous les endpoints construits apparaissent dans Swagger avec leurs schémas de requête/réponse.

---

## 3. Points d'arrêt explicites (ne jamais improviser au-delà)

- Les vulnérabilités pédagogiques, le dispositif Wazuh/Sysmon, et les scénarios d'attaque Active Directory **ne font pas partie de ce plan** : ils sont spécifiés dans les documents Enterprise Breach existants (cahier des charges complet et cahier des charges technique) et constituent une phase ultérieure, à mener seulement après que ce plan soit intégralement complété et validé.
- Ne jamais implémenter une fonctionnalité non décrite dans `01-PRD.md` ou `03-AppFlow.md` sans validation explicite — ce plan décrit un périmètre fermé, pas un point de départ pour de l'improvisation fonctionnelle.
- Ne jamais passer à l'étape suivante sans que le critère de passage de l'étape courante soit vérifié concrètement (pas supposé atteint).

## 4. Suivi de progression suggéré

Pour chaque étape, consigner dans un fichier `PROGRESS.md` à la racine du projet :
- Étape complétée, date.
- Critère de passage vérifié : comment (test manuel, test automatisé).
- Écarts constatés par rapport aux documents de référence, s'il y en a, et comment ils ont été résolus.
