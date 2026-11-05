# PRD — Guinea Finance Enterprise Portal (GFEP)
### Product Requirements Document
Projet parent : Enterprise Breach — laboratoire de cybersécurité Red Team / Blue Team
Version 1.0 — 2026-11-05

---

## 1. Aperçu

Guinea Finance Enterprise Portal (GFEP) est une application web de gestion interne d'entreprise, développée pour une entreprise fictive guinéenne : **GUINEA FINANCE SARL**.

L'application reproduit fidèlement un véritable logiciel de gestion d'entreprise (type ERP RH/Finance léger) : gestion des employés, des départements, des documents, des opérations financières, des accès et des notifications. Elle doit être **crédible comme produit professionnel**, pas comme un prototype ou une démo technique.

GFEP est le cœur applicatif d'un projet plus large, Enterprise Breach, dont l'objectif est d'étudier, dans un environnement isolé et contrôlé, comment une vulnérabilité dans une application web peut devenir le point de départ d'une compromission d'infrastructure (serveur Windows, puis Active Directory). Ce contexte sécurité est documenté séparément (TRD et Implementation Plan) ; **ce PRD décrit le produit tel qu'il doit se comporter et se présenter en mode sécurisé**, c'est-à-dire comme une véritable application d'entreprise.

## 2. Objectif du produit

Construire un portail numérique centralisé permettant aux employés de GUINEA FINANCE SARL de gérer leurs activités professionnelles quotidiennes : consultation d'informations, gestion de documents, suivi d'opérations financières, administration des comptes et des accès.

**Objectifs produit** :
- Offrir une expérience utilisateur premium, au niveau d'un vrai logiciel SaaS d'entreprise (type Workday, BambooHR, ou un ERP moderne).
- Refléter une hiérarchie organisationnelle réaliste avec des permissions différenciées par rôle.
- Fournir une traçabilité complète des actions sensibles (audit).
- Supporter deux méthodes de connexion : compte local et compte d'entreprise (Active Directory).

**Ce que ce produit n'est pas** : une collection d'écrans CRUD génériques, ou une interface "vibecodée" avec des composants par défaut non personnalisés. Chaque écran doit avoir une intention de design claire (voir document UX/UI Design System).

## 3. Cible

**Utilisateurs finaux** : les ~40 employés fictifs de GUINEA FINANCE SARL, répartis sur 6 départements (Direction générale, Ressources humaines, Comptabilité et finances, Informatique, Commercial, Audit et conformité).

**Personas principaux** :

| Persona | Rôle | Besoins principaux |
| --- | --- | --- |
| Mamadou Diallo | Employee (Comptable) | Consulter son profil, accéder aux documents de son département, voir ses notifications |
| Aïssatou Barry | Department Manager | Vue d'ensemble de son équipe, validation de documents, suivi des indicateurs du département |
| Fatoumata Camara | HR Manager | Gestion des fiches employés, suivi des départements, gestion documentaire RH |
| Ibrahima Sow | Accountant | Gestion des transactions et factures, suivi financier |
| Mohamed Keïta | IT Administrator | Gestion des comptes, des rôles, configuration technique, consultation des logs |
| Souleymane Touré | Auditor | Lecture seule sur les journaux d'audit et les événements de sécurité |
| Direction (Super Admin) | Administration complète | Vue globale, configuration système, gestion des rôles |

## 4. Exigences fonctionnelles (résumé produit)

Le détail technique est dans le TRD ; ce PRD liste les exigences du point de vue utilisateur.

### 4.1 Authentification
- L'utilisateur peut se connecter avec un identifiant/mot de passe local, ou avec ses identifiants d'entreprise (compte de domaine).
- En cas d'échec, un message générique et neutre s'affiche (jamais d'indice sur l'existence du compte).
- Après plusieurs échecs, le compte est temporairement bloqué avec un message clair indiquant le délai d'attente.

### 4.2 Dashboard
- Vue d'ensemble adaptée au rôle de l'utilisateur à la connexion.
- Indicateurs : effectifs, activités récentes, transactions récentes, factures en attente, notifications.
- Accès rapide aux actions fréquentes selon le rôle.

### 4.3 Gestion des employés
- Liste, recherche et fiche détaillée par employé.
- Création/modification réservée aux rôles habilités (HR Manager, Super Admin).
- Affichage de la hiérarchie (responsable, équipe).

### 4.4 Gestion des départements
- Vue par département : responsable, effectif, ressources.
- 6 départements fixes, avec leurs responsables.

### 4.5 Gestion documentaire
- Dépôt, consultation, téléchargement, classement par catégorie.
- Permissions par document (qui peut voir/modifier/télécharger).
- Historique de consultation visible pour les documents sensibles.

### 4.6 Gestion financière
- Suivi des transactions et factures fictives.
- Recherche, filtres, export.
- Accès réservé à Accountant, Department Manager (lecture), Super Admin.

### 4.7 Gestion des accès
- Attribution de rôles et permissions, réservée à l'IT Administrator et au Super Admin.
- Vue des comptes actifs/suspendus.

### 4.8 Notifications
- Notifications in-app pour : connexion depuis un nouvel appareil, partage de document, changement de permission, alerte administrative.

### 4.9 Administration et audit
- Consultation des journaux d'activité (lecture pour Auditor, Super Admin).
- Paramètres généraux de l'application (Super Admin uniquement).

## 5. Expérience utilisateur — principes directeurs

1. **Crédibilité avant tout** : chaque écran doit donner l'impression d'un logiciel que de vrais employés utiliseraient quotidiennement — densité d'information maîtrisée, hiérarchie visuelle claire, jamais de placeholder visible en usage normal.
2. **Rôle = contexte** : l'interface change réellement selon le rôle connecté (pas seulement les boutons grisés — le contenu du dashboard et les menus visibles diffèrent).
3. **Feedback immédiat** : toute action (sauvegarde, erreur, suppression) donne un retour visuel clair et non intrusif (toast, état de chargement, confirmation).
4. **Accessibilité raisonnable** : contraste suffisant, navigation clavier possible sur les formulaires principaux, labels explicites.
5. **Cohérence** : un seul design system (voir document dédié), appliqué sans exception à tous les écrans — aucun écran "fait vite" visuellement différent des autres.
6. **Responsive réel** : utilisable sur desktop, tablette et mobile, pas seulement "ne casse pas visuellement".

## 6. Métriques de succès

Comme GFEP est un projet de laboratoire (pas un produit commercial avec utilisateurs réels), les métriques de succès sont évaluées en mode démonstration/validation plutôt qu'en usage réel à grande échelle :

| Métrique | Cible | Comment elle est vérifiée |
| --- | --- | --- |
| Complétude fonctionnelle | 100% des 8 modules opérationnels | Checklist de recette manuelle |
| Fidélité au rôle | Chaque rôle voit uniquement ce qui lui est destiné | Test de connexion avec chacun des 8 rôles |
| Crédibilité visuelle | L'application ne doit pas être identifiable comme un prototype au premier regard | Revue visuelle contre le design system |
| Performance perçue | Chargement d'un écran < 1s avec le jeu de données de test (~40 employés, ~50 documents) | Mesure manuelle / Lighthouse |
| Authentification hybride | Connexion réussie en local ET en AD | Test des deux flux |
| Traçabilité | 100% des actions sensibles définies génèrent une entrée d'audit | Vérification en base après chaque action |

## 7. Hors périmètre (pour ce PRD)

- Les détails d'implémentation technique → voir TRD.
- Les flux d'écran précis et la navigation → voir AppFlow.
- Le schéma de base de données → voir Backend Schema.
- Les vulnérabilités volontaires et le dispositif de sécurité offensif/défensif → traités dans le Implementation Plan et dans les documents Enterprise Breach existants (hors périmètre de ce PRD, qui décrit le produit en mode sécurisé).
- Paiement réel, intégration bancaire réelle, données réelles d'entreprise : explicitement exclus, toutes les données sont fictives.
