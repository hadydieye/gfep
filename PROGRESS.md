# PROGRESS — GFEP

Suivi par étape de `06-Implementation-Plan.md` (§4). Statuts : **terminé** (critère de passage vérifié), **partiel** (implémenté, critère pas entièrement vérifié), **non commencé**.
Décisions et écarts : `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md` (Phase 0, MVP 1) et `.kiro/specs/gfep-mvp2/DECISIONS.md` (MVP 2). Dernière mise à jour : 2026-11-05.

| Étape | Statut | Date | Critère de passage : comment il est vérifié | Écarts / reste à faire |
| --- | --- | --- | --- | --- |
| 0.1 Initialisation | terminé | 2026-11-05 | `GET /api/v1/health` 200 (test automatisé `test/app.e2e-spec.ts`) ; 33/33 tâches Phase 0 cochées | — |
| 0.2 Base de données et Prisma | terminé | 2026-11-05 | Migration appliquée ; `prisma migrate diff` sans écart avec `schema.prisma` ; `schema.prisma` identique à `05` §3 | — |
| 0.3 Thème et design system | terminé | 2026-11-05 | Page `/design-system` (hors production) ; tests de tokens et de contraste WCAG AA par thème (`theme-contrast.test.tsx`) | Bascule de thème dans la topbar : étape 3.2 |
| 1.1 Authentification locale | terminé | 2026-11-05 | Validation manuelle T1.1.10 par l'utilisateur ; automatisé : `auth.int-spec.ts`, `lockout.int-spec.ts`, `validation.int-spec.ts`, `login-form.test.tsx` | Lien « Mot de passe oublié » absent (AppFlow §3.1) |
| 1.2 RBAC basique | terminé | 2026-11-05 | Automatisé : `rbac.int-spec.ts` (200/403 pour les 3 rôles), `route-access.int-spec.ts` (interdiction par défaut) | — |
| 1.3 Dashboard | terminé | 2026-11-05 | Validation visuelle par l'utilisateur des dashboards des 3 comptes ; automatisé : valeurs par rôle (`modules.int-spec.ts`) | — |
| 1.4 Employés | terminé | 2026-11-05 | Validation manuelle T1.4.11 par l'utilisateur ; automatisé : CRUD, scope manager, pagination, recherche, filtres, numérotation concurrente | « Suspendre » reporté à 2.4 (T2.4.R1) ; toast de confirmation et tri par colonne absents |
| 1.5 Départements | terminé | 2026-11-05 | Automatisé : effectif = employés actifs en base (`modules.int-spec.ts`) ; rendu des 6 cartes vérifié (Chrome headless, SUPER_ADMIN) | Ressources documentaires : MVP 2 |
| 2.1 Seed complet | terminé | 2026-11-05 | `npx prisma db seed` exécuté 2 fois sur `gfep_db` : exit 0, comptages SQL identiques (6 départements, 18 postes, 40 employés, 40 comptes LOCAL, 6 catégories, 50 documents + 50 fichiers, 30 factures, 100 transactions ; 3 rôles et 6 permissions selon M3), 0 doublon ; automatisé : `seed.int-spec.ts` (volumes, idempotence, fichiers, personas, mots de passe, refus en production) | Tests MVP 1 mis à jour pour les volumes (gfep-mvp2/DECISIONS.md M27) ; aucune migration ; rôles 8 et permissions 30 atteints en 2.4 et 2.7 ; suite backend plus lente (~110 s) |
| 2.2 Documents | terminé | 2026-11-05 | Migration `document_validation_status` appliquée ; `test/documents.int-spec.ts` passe avec 2 comptes Employee de départements différents et vérifie exhaustivement leur visibilité ; `npm run lint`, `npm run build`, `npm test` passent (backend 118/118, frontend 116/116) ; validation manuelle utilisateur faite (`/documents`, `/documents/[id]`, `/documents/upload`, clair/sombre, responsive) | — |
| 2.3 Finance | non commencé | — | — | — |
| 2.4 RBAC complet | non commencé | — | — | Inclut T2.4.R1 (Suspendre) et T2.4.R2 (déverrouillage manuel) |
| 2.5 Notifications | non commencé | — | — | — |
| 2.6 Administration et audit | non commencé | — | — | — |
| 2.7 Active Directory | non commencé | — | — | — |
| 3.1 Finition UI/UX | non commencé | — | — | Inclut l'export CSV finance reporté du MVP 2 (gfep-mvp2/DECISIONS.md M14) |
| 3.2 Profil et paramètres | non commencé | — | — | — |
| 3.3 Durcissement sécurité | non commencé | — | — | Dette reçue du MVP 2 (gfep-mvp2/DECISIONS.md M20) : compteur `repeated_forbidden` en mémoire |
| 3.4 Tests automatisés | non commencé | — | — | Une partie existe déjà (voir 1.x) |
| 3.5 Documentation API | non commencé | — | — | — |
