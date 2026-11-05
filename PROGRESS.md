# PROGRESS — GFEP

Suivi par étape de `06-Implementation-Plan.md` (§4). Statuts : **terminé** (critère de passage vérifié), **partiel** (implémenté, critère pas entièrement vérifié), **non commencé**.
Décisions et écarts : `.kiro/specs/gfep-lot0-mvp1/DECISIONS.md`. Dernière mise à jour : 2026-11-05.

| Étape | Statut | Date | Critère de passage : comment il est vérifié | Écarts / reste à faire |
| --- | --- | --- | --- | --- |
| 0.1 Initialisation | terminé | 2026-11-05 | `GET /api/v1/health` 200 (test automatisé `test/app.e2e-spec.ts`) ; 33/33 tâches Phase 0 cochées | — |
| 0.2 Base de données et Prisma | terminé | 2026-11-05 | Migration appliquée ; `prisma migrate diff` sans écart avec `schema.prisma` ; `schema.prisma` identique à `05` §3 | — |
| 0.3 Thème et design system | terminé | 2026-11-05 | Page `/design-system` (hors production) ; tests de tokens et de contraste WCAG AA par thème (`theme-contrast.test.tsx`) | Bascule de thème dans la topbar : étape 3.2 |
| 1.1 Authentification locale | partiel | 2026-11-05 | Automatisé : `auth.int-spec.ts`, `lockout.int-spec.ts`, `validation.int-spec.ts`, `login-form.test.tsx` | Validation manuelle T1.1.10 en attente ; lien « Mot de passe oublié » absent (AppFlow §3.1) |
| 1.2 RBAC basique | terminé | 2026-11-05 | Automatisé : `rbac.int-spec.ts` (200/403 pour les 3 rôles), `route-access.int-spec.ts` (interdiction par défaut) | — |
| 1.3 Dashboard | partiel | 2026-11-05 | Automatisé : valeurs par rôle (`modules.int-spec.ts`) | Rendu DEPARTMENT_MANAGER et EMPLOYEE non vérifié dans un navigateur |
| 1.4 Employés | partiel | 2026-11-05 | Automatisé : CRUD, scope manager, pagination, recherche, filtres, numérotation concurrente | Validation manuelle T1.4.11 en attente ; « Suspendre » reporté à 2.4 (T2.4.R1) ; toast de confirmation et tri par colonne absents |
| 1.5 Départements | terminé | 2026-11-05 | Automatisé : effectif = employés actifs en base (`modules.int-spec.ts`) ; rendu des 6 cartes vérifié (Chrome headless, SUPER_ADMIN) | Ressources documentaires : MVP 2 |
| 2.1 Seed complet | non commencé | — | — | Prochaine étape, après clôture des validations manuelles du MVP 1 |
| 2.2 Documents | non commencé | — | — | — |
| 2.3 Finance | non commencé | — | — | — |
| 2.4 RBAC complet | non commencé | — | — | Inclut T2.4.R1 (Suspendre) et T2.4.R2 (déverrouillage manuel) |
| 2.5 Notifications | non commencé | — | — | — |
| 2.6 Administration et audit | non commencé | — | — | — |
| 2.7 Active Directory | non commencé | — | — | — |
| 3.1 Finition UI/UX | non commencé | — | — | — |
| 3.2 Profil et paramètres | non commencé | — | — | — |
| 3.3 Durcissement sécurité | non commencé | — | — | — |
| 3.4 Tests automatisés | non commencé | — | — | Une partie existe déjà (voir 1.x) |
| 3.5 Documentation API | non commencé | — | — | — |
