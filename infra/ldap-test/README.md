# LDAP de test (étape 2.7)

Annuaire OpenLDAP **de test uniquement**, pour valider le flux de connexion Active Directory de GFEP
sans vrai AD (gfep-mvp2/DECISIONS.md M23). Il reproduit la structure de l'AD réel : suffixe
`dc=gnpaytrust,dc=local`, OU `Direction`, `RH`, `Comptabilite`, `Informatique`, `Commercial`,
`Audit`, `ServiceAccounts`.

## Démarrage

```bash
./infra/ldap-test/generate-certs.sh                      # CA + certificat serveur (certs/, non versionné)
docker compose --profile ad-test up -d ldap-test         # LDAPS sur 127.0.0.1:636
LDAP_TEST_PORT=1636 docker compose --profile ad-test up -d ldap-test   # podman rootless : port non privilégié
```

- LDAPS uniquement (`LDAP_TLS_ENFORCE`), port lié à `127.0.0.1`.
- Overlay `memberOf` actif (groupes `groupOfUniqueNames`).
- Le compte de service `cn=svc-ldapreader,ou=ServiceAccounts,dc=gnpaytrust,dc=local` lit l'annuaire,
  sans accès aux mots de passe (`ldif/01-acl.ldif`).

## Contenu (`ldif/02-annuaire.ldif`)

Mots de passe stockés en `{SSHA}`. Valeurs en clair, **de test uniquement** : utilisateurs `AdTest-2026!`,
compte de service `SvcReader-2026!`.

| Utilisateur | OU | Groupes | Cas couvert |
|---|---|---|---|
| `ad.fofana` | Comptabilite | GFEP-Employes | connexion réussie, rôle EMPLOYEE |
| `ad.sylla` | Comptabilite | GFEP-Employes, GFEP-Comptables | deux rôles (EMPLOYEE, ACCOUNTANT) |
| `ad.camara` | Direction | GFEP-SuperAdmins | mapping vers SUPER_ADMIN |
| `ad.kourouma` | Informatique | GFEP-Techniciens | rôle IT_TECHNICIAN |
| `ad.sansgroupe` | Commercial | GFEP-NonMappe | aucun groupe mappé → refus |
| `ad.sansfiche` | RH | GFEP-Employes | aucune fiche Employee → refus |
| `ad.conflit` | Audit | GFEP-Employes | e-mail d'un employé ayant un compte LOCAL → refus |

Les groupes sont placés dans l'OU `Informatique`. Les fiches Employee correspondantes et les mappings
se créent avec `npm run seed:ad-test -w apps/backend` (après le seed complet).

## Configuration du backend

```dotenv
AD_LDAP_URL=ldaps://127.0.0.1:636            # ou :1636
AD_CA_CERT_PATH=<chemin absolu>/infra/ldap-test/certs/ca.crt
AD_BIND_PASSWORD=SvcReader-2026!
```

Les autres variables ont leur valeur de test dans `.env.example`. Tests contre ce LDAP :
`npm run test:ad -w apps/backend` (voir `apps/backend/vitest.config.ad.ts`).
