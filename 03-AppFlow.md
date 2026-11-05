# AppFlow — Guinea Finance Enterprise Portal (GFEP)
### Cartographie de la navigation et des parcours utilisateurs
Version 1.0 — 2026-11-05

---

## 1. Objet

Ce document cartographie **tous les écrans** de l'application, leur contenu, les transitions entre eux, et les parcours utilisateurs par rôle. Il sert de référence pour construire la navigation et s'assurer qu'aucun écran n'est orphelin ou inaccessible.

## 2. Carte globale des écrans

```
/login                              (public)
/login/ad                           (public — bascule depuis /login)
  |
  v
/dashboard                          (protégé — point d'entrée après connexion)
  |
  |-- /employees                    (liste)
  |     |-- /employees/[id]         (fiche détail)
  |     |-- /employees/new          (création — rôles habilités)
  |     |-- /employees/[id]/edit    (édition — rôles habilités)
  |
  |-- /departments                  (liste des 6 départements)
  |     |-- /departments/[id]       (détail département)
  |
  |-- /documents                    (liste / bibliothèque)
  |     |-- /documents/[id]         (détail + prévisualisation)
  |     |-- /documents/upload       (dépôt)
  |
  |-- /finance
  |     |-- /finance/transactions   (liste transactions)
  |     |-- /finance/transactions/new
  |     |-- /finance/invoices       (liste factures)
  |     |-- /finance/invoices/[id]
  |
  |-- /access                       (gestion des rôles/permissions — IT Admin, Super Admin)
  |     |-- /access/roles
  |     |-- /access/roles/[id]
  |     |-- /access/users           (comptes applicatifs)
  |
  |-- /notifications                (liste des notifications)
  |
  |-- /admin                        (Super Admin uniquement)
  |     |-- /admin/settings
  |     |-- /admin/audit            (journaux — aussi accessible à Auditor en lecture)
  |
  |-- /profile                      (profil de l'utilisateur connecté, tous rôles)
  |
  '-- /logout                       (action, pas un écran)
```

## 3. Détail de chaque écran

### 3.1 `/login`
- **Contenu** : logo, formulaire identifiant/mot de passe, lien "Se connecter avec le compte d'entreprise" (bascule vers `/login/ad`), lien "Mot de passe oublié".
- **Transitions** : succès → `/dashboard`. Échec → message d'erreur générique, reste sur `/login`. Compte verrouillé (temporairement, 15 minutes) → même message générique que tout autre échec, sans délai affiché (correction consignée dans `DECISIONS.md`, I20).
- **Accès** : public (non authentifié uniquement — un utilisateur déjà connecté est redirigé vers `/dashboard`).

### 3.2 `/login/ad`
- **Contenu** : formulaire identifiant/mot de passe (identifiants du domaine), lien retour vers connexion locale.
- **Transitions** : identiques à `/login`, avec message d'erreur distinct si Active Directory est injoignable ("Service d'authentification d'entreprise indisponible, réessayez plus tard ou utilisez votre compte local").

### 3.3 `/dashboard`
- **Contenu** (varie selon rôle, voir section 5) : cartes d'indicateurs, liste d'activités récentes, accès rapides.
- **Transitions** : vers chaque module via le menu latéral (toujours visible).
- **Accès** : tous rôles authentifiés, contenu personnalisé.

### 3.4 `/employees` et sous-écrans
- **Liste** : tableau avec recherche, filtres (département, statut), pagination. Clic sur une ligne → fiche détail.
- **Fiche détail** (`/employees/[id]`) : informations personnelles et professionnelles, historique, document liés, bouton "Modifier" (si habilité), bouton "Suspendre" (si habilité).
- **Création/édition** : formulaire avec validation en temps réel (React Hook Form + Zod), sélection département/poste/responsable.
- **Accès liste/détail** : tous rôles authentifiés (lecture). **Création/édition/suspension** : HR Manager, Department Manager (son département uniquement), Super Admin.

### 3.5 `/departments` et sous-écrans
- **Liste** : 6 cartes de département avec effectif et responsable.
- **Détail** : informations du département, liste des employés rattachés, ressources documentaires du département.
- **Accès** : lecture pour tous ; édition réservée à HR Manager, Super Admin.

### 3.6 `/documents` et sous-écrans
- **Liste** : vue bibliothèque avec filtres par catégorie, recherche, indicateur de confidentialité.
- **Détail** : métadonnées, aperçu si type supporté, bouton télécharger, historique de consultation (visible selon rôle).
- **Upload** : formulaire de dépôt avec sélection catégorie et niveau de confidentialité.
- **Accès** : la visibilité d'un document dépend de ses permissions propres (`document_permissions`), pas uniquement du rôle global — un Employee ne voit que les documents de son département ou explicitement partagés avec lui.

### 3.7 `/finance/*`
- **Transactions** : liste filtrable, création (Accountant, Super Admin), lecture seule pour Department Manager de son périmètre.
- **Factures** : liste, détail, statut (payée/en attente/en retard).
- **Accès** : Accountant (plein accès), Department Manager (lecture limitée à son département), Super Admin (plein accès), autres rôles : pas d'accès au menu Finance.

### 3.8 `/access/*`
- **Rôles** : liste des 8 rôles, détail des permissions par rôle, édition.
- **Utilisateurs (comptes)** : liste des comptes applicatifs avec leur rôle, statut, méthode d'authentification (local/AD).
- **Accès** : IT Administrator, Super Admin uniquement. Les autres rôles n'ont pas cette entrée dans le menu.

### 3.9 `/notifications`
- **Contenu** : liste chronologique des notifications de l'utilisateur, filtrage lu/non lu.
- **Accès** : tous rôles, contenu propre à chaque utilisateur.

### 3.10 `/admin/*`
- **Settings** : paramètres généraux de l'application (Super Admin uniquement).
- **Audit** : consultation des journaux d'activité et événements de sécurité, avec filtres (date, utilisateur, type d'action). Accessible en lecture à Auditor, en lecture/gestion à Super Admin.

### 3.11 `/profile`
- **Contenu** : informations personnelles de l'utilisateur connecté, changement de mot de passe (si compte local), préférences d'affichage (thème clair/sombre).
- **Accès** : tous rôles, sur son propre profil uniquement.

## 4. Navigation globale (layout)

- **Barre latérale** (sidebar) persistante, dont les entrées de menu sont générées dynamiquement selon le rôle connecté (jamais un menu complet avec entrées grisées — les entrées non autorisées n'apparaissent pas).
- **Barre supérieure** : nom de l'utilisateur, notifications (badge compteur), bascule thème clair/sombre, accès rapide au profil et à la déconnexion.
- **Fil d'Ariane** (breadcrumb) sur les écrans de détail (ex: Employés > Mamadou Diallo).

## 5. Contenu du dashboard par rôle

| Rôle | Cartes principales affichées |
| --- | --- |
| Employee | Mes informations, mes documents récents, mes notifications |
| Department Manager | Effectif de l'équipe, documents en attente de validation, indicateurs du département |
| HR Manager | Effectifs globaux, répartition par département, nouvelles embauches récentes |
| Accountant | Transactions récentes, factures en attente, indicateurs financiers |
| IT Administrator | Comptes récemment créés/suspendus, événements de sécurité récents, état des services |
| Auditor | Derniers événements d'audit, alertes de sécurité |
| Super Admin | Vue consolidée de tous les indicateurs ci-dessus |

## 6. Parcours utilisateur type (exemple illustratif)

**Parcours : HR Manager crée un nouvel employé**
1. Connexion (`/login`) → `/dashboard`.
2. Clic sur "Employés" dans la sidebar → `/employees`.
3. Clic sur "Nouvel employé" → `/employees/new`.
4. Remplissage du formulaire (identité, département, poste, responsable) → soumission.
5. Validation backend → création en base → événement d'audit généré → redirection vers `/employees/[id]` (fiche du nouvel employé) avec confirmation (toast).
6. Une notification est générée pour le responsable désigné.

**Parcours : Employee consulte un document partagé**
1. Connexion → `/dashboard` → carte "Mes documents récents" → clic → `/documents/[id]`.
   Ou : sidebar "Documents" → `/documents` → recherche/filtre → clic sur une ligne → `/documents/[id]`.
2. Si l'utilisateur n'a pas la permission sur ce document : message "Vous n'avez pas accès à ce document", pas d'affichage du contenu (vérifié côté backend, pas seulement masqué côté interface).

## 7. États d'écran à prévoir systématiquement

Chaque écran de liste ou de détail doit prévoir, dès la conception :
- État de chargement (skeleton, pas de spinner générique isolé).
- État vide (aucune donnée) avec message contextuel, pas un tableau vide silencieux.
- État d'erreur (échec de chargement) avec option de réessayer.
- État "accès refusé" distinct de l'état "ressource introuvable" (403 vs 404), avec des messages différents.
