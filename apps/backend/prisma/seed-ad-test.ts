/**
 * Données du LDAP de test (étape 2.7, M23), commande `npm run seed:ad-test`, à lancer
 * après le seed complet. Crée les fiches Employee des utilisateurs de test
 * (infra/ldap-test/ldif/02-annuaire.ldif), **sans compte local**, hors des 40 employés
 * de 05 §7, et les mappings des groupes de test `GFEP-*`. Idempotent. Réservé au
 * développement et aux tests : refuse NODE_ENV=production. Jamais un vrai AD.
 * TODO(AD-REVISION) : groupes et mappings de production à définir.
 */
import { PrismaClient } from '@prisma/client';
import { assertNotProduction } from './seed-lib.js';

const BASE_DN = process.env.AD_BASE_DN?.trim() || 'dc=gnpaytrust,dc=local';
const GROUPS_OU = `ou=Informatique,${BASE_DN}`;

// [numéro, prénom, nom, e-mail, département, poste] — e-mails identiques à l'annuaire de test
export const AD_TEST_EMPLOYEES = [
  ['GF-2026-901', 'Aminata', 'Fofana', 'ad.fofana@guineasf.com', 'CF', 'Comptable'],
  ['GF-2026-902', 'Mamadi', 'Sylla', 'ad.sylla@guineasf.com', 'CF', 'Comptable'],
  ['GF-2026-903', 'Lansana', 'Camara', 'ad.camara@guineasf.com', 'DG', 'Chargé(e) de mission'],
  ['GF-2026-904', 'Sekou', 'Kourouma', 'ad.kourouma@guineasf.com', 'IT', 'Technicien support'],
  // Utilisateur dont aucun groupe n'est mappé (défaut sûr AD_NO_ROLE_MAPPING)
  ['GF-2026-905', 'Nana', 'Keita', 'ad.sansgroupe@guineasf.com', 'CO', 'Commercial terrain'],
] as const;

export const AD_TEST_MAPPINGS = [
  [`cn=GFEP-Employes,${GROUPS_OU}`, 'EMPLOYEE'],
  [`cn=GFEP-Comptables,${GROUPS_OU}`, 'ACCOUNTANT'],
  [`cn=GFEP-Techniciens,${GROUPS_OU}`, 'IT_TECHNICIAN'],
  [`cn=GFEP-SuperAdmins,${GROUPS_OU}`, 'SUPER_ADMIN'],
] as const;

async function main() {
  assertNotProduction('Seed AD de test');
  const prisma = new PrismaClient();
  try {
    for (const [number, firstName, lastName, email, departmentCode, title] of AD_TEST_EMPLOYEES) {
      const department = await prisma.department.findUnique({ where: { code: departmentCode } });
      const position = department
        ? await prisma.position.findFirst({ where: { departmentId: department.id, title } })
        : null;
      if (!department || !position) {
        throw new Error(`Département ${departmentCode} ou poste « ${title} » absent : lancez d'abord le seed complet.`);
      }
      const fields = {
        firstName,
        lastName,
        professionalEmail: email,
        departmentId: department.id,
        positionId: position.id,
        hireDate: new Date('2025-01-06'),
      };
      await prisma.employee.upsert({
        where: { employeeNumber: number },
        update: fields,
        create: { employeeNumber: number, ...fields },
      });
    }
    for (const [adGroupDn, roleName] of AD_TEST_MAPPINGS) {
      const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
      await prisma.adGroupRoleMapping.upsert({
        where: { adGroupDn },
        update: { roleId: role.id },
        create: { adGroupDn, roleId: role.id },
      });
    }
    console.log(
      `Seed AD de test terminé : ${AD_TEST_EMPLOYEES.length} fiches sans compte local, ${AD_TEST_MAPPINGS.length} mappings (${BASE_DN}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
