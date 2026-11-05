# Instructions de travail GFEP

## Sources et périmètre

- Les six documents racine (`01-PRD.md` à `06-Implementation-Plan.md`) et les décisions consignées dans les fichiers `DECISIONS.md` du dépôt font foi. Ne prendre aucune décision en dehors de ces fichiers. En cas d'ambiguïté ou de contradiction non résolue, poser une question avant d'agir.
- GFEP est une application d'entreprise fictive saine pour un laboratoire Red Team / Blue Team. L'ajout de vulnérabilités pédagogiques est ultérieur, séparé et hors du périmètre actuel.

## Déroulement du travail

- Traiter une seule étape à la fois, dans l'ordre de `06-Implementation-Plan.md`. Ne pas commencer l'étape suivante avant d'avoir vérifié concrètement le critère de passage de l'étape en cours.
- Cocher une tâche ou une case uniquement après sa vérification réelle. Ne pas cocher une validation visuelle réservée à l'utilisateur.
- Arrêter le travail à la fin de chaque étape et fournir un rapport de son état, des vérifications effectuées et des éventuels écarts.
- Avant et après chaque étape, `npm run lint`, `npm run build` et `npm test` doivent réussir.
- Toute vérification visuelle impossible à réaliser doit être consignée sous « validation manuelle utilisateur en attente ».

## Sécurité backend

- Appliquer l'interdiction par défaut des guards : `@Public()` uniquement pour les routes publiques prévues par les documents ; `@AuthenticatedOnly()` est réservé à `/auth/me` et `/auth/logout` ; toute autre route doit porter `@Roles(...)` et `@Permission(...)`.
- Valider les DTO avec `class-validator`, `whitelist: true` et le rejet des propriétés non déclarées (`forbidNonWhitelisted`).
- Les migrations Prisma sont additives uniquement. Toute évolution du schéma exige la mise à jour correspondante de `05-Backend-Schema.md` et l'ajout ou la mise à jour d'une décision dans `DECISIONS.md`.
- Protéger les seeds contre `NODE_ENV=production`. Ne jamais écrire ni journaliser de mots de passe en clair.

## Interface

- Respecter strictement le design system de `04-UXUI-Design-System.md` : tokens définis, icônes Lucide, modes clair et sombre, contrastes WCAG AA et aucun placeholder visible.