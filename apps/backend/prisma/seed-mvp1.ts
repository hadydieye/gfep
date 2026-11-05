/**
 * Seed MVP 1 — données minimales (6 départements, 6 postes, 6 employés,
 * 3 rôles, 6 permissions, 3 comptes locaux). Ce jeu sert de base au seed
 * complet (`prisma/seed.ts`, gfep-mvp2/DECISIONS.md M3), qui l'étend.
 * Idempotent : une seconde exécution ne crée aucun doublon et réinitialise
 * les comptes de démonstration (mot de passe, statut ACTIVE, compteur d'échecs).
 *
 * Exécution autonome : `npx tsx prisma/seed-mvp1.ts` depuis apps/backend.
 */
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { PrismaClient } from '@prisma/client';
import {
  OrganisationDataset,
  SeededOrganisation,
  assertNotProduction,
  hashRolePasswords,
  seedOrganisation,
} from './seed-lib.js';

const MVP1_PERMISSIONS = [
  { resource: 'dashboard', action: 'read', description: 'Accéder au tableau de bord' },
  { resource: 'employees', action: 'read', description: 'Consulter la liste et les fiches employés' },
  { resource: 'employees', action: 'write', description: 'Créer et modifier des employés' },
  { resource: 'employees', action: 'delete', description: 'Supprimer des employés' },
  { resource: 'departments', action: 'read', description: 'Consulter la liste et le détail des départements' },
  { resource: 'departments', action: 'write', description: 'Modifier les informations d’un département' },
] as const;

export const MVP1_DATA = {
  departments: [
    { code: 'DG', name: 'Direction générale', description: 'Pilotage stratégique de l’entreprise' },
    { code: 'RH', name: 'Ressources humaines', description: 'Gestion du personnel et des carrières' },
    { code: 'CF', name: 'Comptabilité et finances', description: 'Comptabilité, trésorerie et reporting' },
    { code: 'IT', name: 'Informatique', description: 'Systèmes d’information et support' },
    { code: 'CO', name: 'Commercial', description: 'Relation client et développement' },
    { code: 'AC', name: 'Audit et conformité', description: 'Contrôle interne et conformité' },
  ],
  positions: [
    { title: 'Directeur général', department: 'DG', hierarchyLevel: 1 },
    { title: 'Responsable RH', department: 'RH', hierarchyLevel: 2 },
    { title: 'Responsable comptable', department: 'CF', hierarchyLevel: 2 },
    { title: 'Responsable informatique', department: 'IT', hierarchyLevel: 2 },
    { title: 'Responsable commercial', department: 'CO', hierarchyLevel: 2 },
    { title: 'Responsable audit', department: 'AC', hierarchyLevel: 2 },
  ],
  // GF-2026-006 complète le jeu de design.md §8.3 pour que chaque département ait un effectif non nul
  employees: [
    { number: 'GF-2026-001', firstName: 'Fatoumata', lastName: 'Camara', email: 'f.camara@guineasf.com', department: 'RH', position: 'Responsable RH', hireDate: '2019-03-01', managerNumber: 'GF-2026-004' },
    { number: 'GF-2026-002', firstName: 'Mamadou', lastName: 'Diallo', email: 'm.diallo@guineasf.com', department: 'CF', position: 'Responsable comptable', hireDate: '2020-06-15', managerNumber: 'GF-2026-004' },
    { number: 'GF-2026-003', firstName: 'Ibrahim', lastName: 'Sow', email: 'i.sow@guineasf.com', department: 'IT', position: 'Responsable informatique', hireDate: '2021-01-11', managerNumber: 'GF-2026-004' },
    { number: 'GF-2026-004', firstName: 'Mohamed', lastName: 'Keïta', email: 'm.keita@guineasf.com', department: 'DG', position: 'Directeur général', hireDate: '2015-09-01', managerNumber: null },
    { number: 'GF-2026-005', firstName: 'Aïssatou', lastName: 'Barry', email: 'a.barry@guineasf.com', department: 'AC', position: 'Responsable audit', hireDate: '2022-04-04', managerNumber: 'GF-2026-004' },
    { number: 'GF-2026-006', firstName: 'Kadiatou', lastName: 'Bangoura', email: 'k.bangoura@guineasf.com', department: 'CO', position: 'Responsable commercial', hireDate: '2023-02-20', managerNumber: 'GF-2026-004' },
  ],
  departmentManagers: {
    DG: 'GF-2026-004',
    RH: 'GF-2026-001',
    CF: 'GF-2026-002',
    IT: 'GF-2026-003',
    CO: 'GF-2026-006',
    AC: 'GF-2026-005',
  },
  roles: [
    { name: 'SUPER_ADMIN', description: 'Administrateur général — accès complet' },
    { name: 'DEPARTMENT_MANAGER', description: 'Responsable de département — écriture limitée à son département' },
    { name: 'EMPLOYEE', description: 'Employé — consultation' },
  ],
  permissions: MVP1_PERMISSIONS,
  rolePermissions: {
    SUPER_ADMIN: MVP1_PERMISSIONS.map((p) => `${p.resource}:${p.action}`),
    DEPARTMENT_MANAGER: ['dashboard:read', 'employees:read', 'employees:write', 'departments:read'],
    EMPLOYEE: ['dashboard:read', 'employees:read', 'departments:read'],
  },
  users: [
    { username: 'm.keita', employee: 'GF-2026-004', role: 'SUPER_ADMIN' },
    { username: 'f.camara', employee: 'GF-2026-001', role: 'DEPARTMENT_MANAGER' },
    { username: 'm.diallo', employee: 'GF-2026-002', role: 'EMPLOYEE' },
  ],
} as const satisfies OrganisationDataset;

export async function seedMvp1(
  prisma: PrismaClient,
  passwordHashes: Map<string, string>,
): Promise<SeededOrganisation> {
  return seedOrganisation(prisma, MVP1_DATA, passwordHashes);
}

async function main() {
  assertNotProduction('Seed MVP 1');
  const prisma = new PrismaClient();
  try {
    const hashes = await hashRolePasswords(MVP1_DATA.roles.map((r) => r.name));
    await seedMvp1(prisma, hashes);
    console.log(
      `Seed MVP 1 terminé : ${MVP1_DATA.departments.length} départements, ${MVP1_DATA.positions.length} postes, ` +
        `${MVP1_DATA.employees.length} employés, ${MVP1_DATA.roles.length} rôles, ` +
        `${MVP1_DATA.permissions.length} permissions, ${MVP1_DATA.users.length} utilisateurs.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution autonome uniquement (pas lors d'un import par prisma/seed.ts)
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
