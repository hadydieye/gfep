/**
 * Seed MVP 1 — données minimales (6 départements, 6 postes, 6 employés,
 * 3 rôles, 6 permissions, 3 comptes locaux). Idempotent : chaque entité est
 * upsertée, une seconde exécution ne crée aucun doublon et réinitialise les
 * comptes de démonstration (mot de passe, statut ACTIVE, compteur d'échecs).
 *
 * Exécution : `npx prisma db seed` depuis apps/backend.
 */
import { AuthProvider, PrismaClient, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

// Réservé au développement : mots de passe de démo et réinitialisation des comptes
if (process.env.NODE_ENV === 'production') {
  console.error(
    'Seed MVP 1 refusé : NODE_ENV=production. Ce script crée des comptes avec des mots de passe ' +
      'de démonstration et réinitialise les comptes existants ; il est réservé au développement.',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { code: 'DG', name: 'Direction générale', description: 'Pilotage stratégique de l’entreprise' },
  { code: 'RH', name: 'Ressources humaines', description: 'Gestion du personnel et des carrières' },
  { code: 'CF', name: 'Comptabilité et finances', description: 'Comptabilité, trésorerie et reporting' },
  { code: 'IT', name: 'Informatique', description: 'Systèmes d’information et support' },
  { code: 'CO', name: 'Commercial', description: 'Relation client et développement' },
  { code: 'AC', name: 'Audit et conformité', description: 'Contrôle interne et conformité' },
] as const;

const POSITIONS = [
  { title: 'Directeur général', department: 'DG', hierarchyLevel: 1 },
  { title: 'Responsable RH', department: 'RH', hierarchyLevel: 2 },
  { title: 'Responsable comptable', department: 'CF', hierarchyLevel: 2 },
  { title: 'Responsable informatique', department: 'IT', hierarchyLevel: 2 },
  { title: 'Responsable commercial', department: 'CO', hierarchyLevel: 2 },
  { title: 'Responsable audit', department: 'AC', hierarchyLevel: 2 },
] as const;

// GF-2026-006 complète le jeu de design.md §8.3 pour que chaque département ait un effectif non nul
const EMPLOYEES = [
  { number: 'GF-2026-001', firstName: 'Fatoumata', lastName: 'Camara', email: 'f.camara@guineasf.com', department: 'RH', position: 'Responsable RH', hireDate: '2019-03-01' },
  { number: 'GF-2026-002', firstName: 'Mamadou', lastName: 'Diallo', email: 'm.diallo@guineasf.com', department: 'CF', position: 'Responsable comptable', hireDate: '2020-06-15' },
  { number: 'GF-2026-003', firstName: 'Ibrahim', lastName: 'Sow', email: 'i.sow@guineasf.com', department: 'IT', position: 'Responsable informatique', hireDate: '2021-01-11' },
  { number: 'GF-2026-004', firstName: 'Mohamed', lastName: 'Keïta', email: 'm.keita@guineasf.com', department: 'DG', position: 'Directeur général', hireDate: '2015-09-01' },
  { number: 'GF-2026-005', firstName: 'Aïssatou', lastName: 'Barry', email: 'a.barry@guineasf.com', department: 'AC', position: 'Responsable audit', hireDate: '2022-04-04' },
  { number: 'GF-2026-006', firstName: 'Kadiatou', lastName: 'Bangoura', email: 'k.bangoura@guineasf.com', department: 'CO', position: 'Responsable commercial', hireDate: '2023-02-20' },
] as const;

const DG_EMPLOYEE = 'GF-2026-004';

const ROLES = [
  { name: 'SUPER_ADMIN', description: 'Administrateur général — accès complet' },
  { name: 'DEPARTMENT_MANAGER', description: 'Responsable de département — écriture limitée à son département' },
  { name: 'EMPLOYEE', description: 'Employé — consultation' },
] as const;

const PERMISSIONS = [
  { resource: 'dashboard', action: 'read', description: 'Accéder au tableau de bord' },
  { resource: 'employees', action: 'read', description: 'Consulter la liste et les fiches employés' },
  { resource: 'employees', action: 'write', description: 'Créer et modifier des employés' },
  { resource: 'employees', action: 'delete', description: 'Supprimer des employés' },
  { resource: 'departments', action: 'read', description: 'Consulter la liste et le détail des départements' },
  { resource: 'departments', action: 'write', description: 'Modifier les informations d’un département' },
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => `${p.resource}:${p.action}`),
  DEPARTMENT_MANAGER: ['dashboard:read', 'employees:read', 'employees:write', 'departments:read'],
  EMPLOYEE: ['dashboard:read', 'employees:read', 'departments:read'],
};

// Mots de passe de démonstration (design.md §8.3), surchargeables par variable d'environnement.
// Ils ne sont jamais loggés ni stockés en clair : seul le hash argon2 est persisté.
const USERS = [
  { username: 'm.keita', email: 'm.keita@guineasf.com', role: 'SUPER_ADMIN', employee: 'GF-2026-004', password: process.env.SEED_PASSWORD_SUPER_ADMIN ?? 'GF_Admin2026!' },
  { username: 'f.camara', email: 'f.camara@guineasf.com', role: 'DEPARTMENT_MANAGER', employee: 'GF-2026-001', password: process.env.SEED_PASSWORD_DEPARTMENT_MANAGER ?? 'GF_Mgr2026!' },
  { username: 'm.diallo', email: 'm.diallo@guineasf.com', role: 'EMPLOYEE', employee: 'GF-2026-002', password: process.env.SEED_PASSWORD_EMPLOYEE ?? 'GF_Emp2026!' },
] as const;

async function main() {
  // 1. Départements
  const departmentIds = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const department = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description },
      create: { code: d.code, name: d.name, description: d.description },
    });
    departmentIds.set(d.code, department.id);
  }

  // 2. Postes (pas de contrainte unique sur le titre : recherche avant création)
  const positionIds = new Map<string, string>();
  for (const p of POSITIONS) {
    const departmentId = departmentIds.get(p.department)!;
    const existing = await prisma.position.findFirst({ where: { title: p.title, departmentId } });
    const position = existing
      ? await prisma.position.update({
          where: { id: existing.id },
          data: { hierarchyLevel: p.hierarchyLevel },
        })
      : await prisma.position.create({
          data: { title: p.title, departmentId, hierarchyLevel: p.hierarchyLevel },
        });
    positionIds.set(p.title, position.id);
  }

  // 3. Employés (managerId renseigné à l'étape suivante)
  const employeeIds = new Map<string, string>();
  for (const e of EMPLOYEES) {
    const data = {
      firstName: e.firstName,
      lastName: e.lastName,
      professionalEmail: e.email,
      departmentId: departmentIds.get(e.department)!,
      positionId: positionIds.get(e.position)!,
      hireDate: new Date(e.hireDate),
    };
    const employee = await prisma.employee.upsert({
      where: { employeeNumber: e.number },
      update: data,
      create: { employeeNumber: e.number, ...data },
    });
    employeeIds.set(e.number, employee.id);
  }

  // 4. Hiérarchie : tous les responsables rapportent au Directeur général
  const dgId = employeeIds.get(DG_EMPLOYEE)!;
  for (const e of EMPLOYEES) {
    await prisma.employee.update({
      where: { employeeNumber: e.number },
      data: { managerId: e.number === DG_EMPLOYEE ? null : dgId },
    });
  }

  // 5. Responsables de département
  for (const e of EMPLOYEES) {
    await prisma.department.update({
      where: { code: e.department },
      data: { managerId: employeeIds.get(e.number)! },
    });
  }

  // 6. Rôles
  const roleIds = new Map<string, string>();
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
    roleIds.set(r.name, role.id);
  }

  // 7. Permissions
  const permissionIds = new Map<string, string>();
  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { description: p.description },
      create: { resource: p.resource, action: p.action, description: p.description },
    });
    permissionIds.set(`${p.resource}:${p.action}`, permission.id);
  }

  // 8. Rôles ↔ permissions
  for (const [roleName, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds.get(roleName)!;
    for (const key of keys) {
      const permissionId = permissionIds.get(key)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // 9. Utilisateurs locaux (hash argon2)
  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const passwordHash = await argon2.hash(u.password);
    const reset = { passwordHash, status: UserStatus.ACTIVE, failedLoginCount: 0 };
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: { email: u.email, ...reset },
      create: { username: u.username, email: u.email, authProvider: AuthProvider.LOCAL, ...reset },
    });
    userIds.set(u.username, user.id);
  }

  // 10. Identités employé
  for (const u of USERS) {
    const userId = userIds.get(u.username)!;
    const employeeId = employeeIds.get(u.employee)!;
    await prisma.employeeIdentity.upsert({
      where: { userId },
      update: { employeeId },
      create: { userId, employeeId },
    });
  }

  // 11. Utilisateurs ↔ rôles (attribués par le SUPER_ADMIN)
  const adminId = userIds.get('m.keita')!;
  for (const u of USERS) {
    const userId = userIds.get(u.username)!;
    const roleId = roleIds.get(u.role)!;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId, assignedBy: adminId },
    });
  }

  console.log(
    `Seed MVP 1 terminé : ${DEPARTMENTS.length} départements, ${POSITIONS.length} postes, ` +
      `${EMPLOYEES.length} employés, ${ROLES.length} rôles, ${PERMISSIONS.length} permissions, ` +
      `${USERS.length} utilisateurs.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
