/**
 * Fonctions communes des seeds GFEP. Toutes les écritures sont idempotentes
 * (upsert ou recherche avant création) : une seconde exécution ne crée aucun
 * doublon et resynchronise les comptes de démonstration.
 */
import { AuthProvider, PrismaClient, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

export interface DepartmentSeed {
  code: string;
  name: string;
  description: string;
}

export interface PositionSeed {
  title: string;
  department: string;
  hierarchyLevel: number;
}

export interface EmployeeSeed {
  number: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  hireDate: string;
  /** Numéro du responsable hiérarchique, null pour le sommet */
  managerNumber: string | null;
}

export interface UserSeed {
  username: string;
  employee: string;
  role: string;
}

export interface OrganisationDataset {
  departments: readonly DepartmentSeed[];
  positions: readonly PositionSeed[];
  employees: readonly EmployeeSeed[];
  /** Code de département → numéro de l'employé responsable */
  departmentManagers: Readonly<Record<string, string>>;
  roles: ReadonlyArray<{ name: string; description: string }>;
  permissions: ReadonlyArray<{ resource: string; action: string; description: string }>;
  /** Rôle → clés `resource:action` ; l'ensemble est synchronisé à l'identique */
  rolePermissions: Readonly<Record<string, readonly string[]>>;
  users: readonly UserSeed[];
}

export interface SeededOrganisation {
  departmentIds: Map<string, string>;
  employeeIds: Map<string, string>;
  userIds: Map<string, string>;
  /** Numéro d'employé → identifiant de compte */
  userIdByEmployee: Map<string, string>;
}

/** Réservé au développement : mots de passe de démo et réinitialisation des comptes. */
export function assertNotProduction(label: string): void {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      `${label} refusé : NODE_ENV=production. Ce script crée des comptes avec des mots de passe ` +
        'de démonstration et réinitialise les comptes existants ; il est réservé au développement.',
    );
    process.exit(1);
  }
}

// Valeurs par défaut documentées (gfep-lot0-mvp1/design.md §8.3), surchargeables par SEED_PASSWORD_<ROLE>
const DEFAULT_PASSWORDS: Record<string, string> = {
  SUPER_ADMIN: 'GF_Admin2026!',
  DEPARTMENT_MANAGER: 'GF_Mgr2026!',
  EMPLOYEE: 'GF_Emp2026!',
};

/** Un hash argon2 par rôle et par exécution ; les mots de passe ne sont jamais loggés. */
export async function hashRolePasswords(roles: readonly string[]): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const role of roles) {
    // Une valeur vide vaut « non définie » : jamais de mot de passe vide
    const password = process.env[`SEED_PASSWORD_${role}`] || DEFAULT_PASSWORDS[role];
    if (!password) {
      throw new Error(`Aucun mot de passe de démonstration pour le rôle ${role} (SEED_PASSWORD_${role}).`);
    }
    hashes.set(role, await argon2.hash(password));
  }
  return hashes;
}

/** `initiale.nom`, sans accents ni caractères spéciaux, en minuscules. */
export function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

export async function seedOrganisation(
  prisma: PrismaClient,
  data: OrganisationDataset,
  passwordHashes: Map<string, string>,
): Promise<SeededOrganisation> {
  // 1. Départements
  const departmentIds = new Map<string, string>();
  for (const d of data.departments) {
    const department = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description },
      create: { code: d.code, name: d.name, description: d.description },
    });
    departmentIds.set(d.code, department.id);
  }

  // 2. Postes (pas de contrainte unique sur le titre : recherche avant création)
  const positionIds = new Map<string, string>();
  for (const p of data.positions) {
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
    positionIds.set(`${p.department}:${p.title}`, position.id);
  }

  // 3. Employés, puis hiérarchie (le responsable doit exister avant d'être référencé)
  const employeeIds = new Map<string, string>();
  for (const e of data.employees) {
    const fields = {
      firstName: e.firstName,
      lastName: e.lastName,
      professionalEmail: e.email,
      departmentId: departmentIds.get(e.department)!,
      positionId: positionIds.get(`${e.department}:${e.position}`)!,
      hireDate: new Date(e.hireDate),
    };
    const employee = await prisma.employee.upsert({
      where: { employeeNumber: e.number },
      update: fields,
      create: { employeeNumber: e.number, ...fields },
    });
    employeeIds.set(e.number, employee.id);
  }
  for (const e of data.employees) {
    await prisma.employee.update({
      where: { employeeNumber: e.number },
      data: { managerId: e.managerNumber ? employeeIds.get(e.managerNumber)! : null },
    });
  }

  // 4. Responsables de département : on libère d'abord les postes (managerId unique)
  await prisma.department.updateMany({
    where: { code: { in: Object.keys(data.departmentManagers) } },
    data: { managerId: null },
  });
  for (const [code, number] of Object.entries(data.departmentManagers)) {
    await prisma.department.update({
      where: { code },
      data: { managerId: employeeIds.get(number)! },
    });
  }

  // 5. Rôles, permissions et matrice (synchronisée à l'identique)
  const roleIds = new Map<string, string>();
  for (const r of data.roles) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
    roleIds.set(r.name, role.id);
  }
  const permissionIds = new Map<string, string>();
  for (const p of data.permissions) {
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: p.resource, action: p.action } },
      update: { description: p.description },
      create: { resource: p.resource, action: p.action, description: p.description },
    });
    permissionIds.set(`${p.resource}:${p.action}`, permission.id);
  }
  for (const [roleName, keys] of Object.entries(data.rolePermissions)) {
    const roleId = roleIds.get(roleName)!;
    const wanted = keys.map((key) => permissionIds.get(key)!);
    await prisma.rolePermission.deleteMany({ where: { roleId, permissionId: { notIn: wanted } } });
    for (const permissionId of wanted) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  // 6. Comptes locaux (réinitialisés : mot de passe du rôle, statut ACTIVE, compteur à 0)
  const userIds = new Map<string, string>();
  const userIdByEmployee = new Map<string, string>();
  const employeeByNumber = new Map(data.employees.map((e) => [e.number, e]));
  for (const u of data.users) {
    const employee = employeeByNumber.get(u.employee)!;
    const reset = {
      email: employee.email,
      passwordHash: passwordHashes.get(u.role)!,
      status: UserStatus.ACTIVE,
      failedLoginCount: 0,
    };
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: reset,
      create: { username: u.username, authProvider: AuthProvider.LOCAL, ...reset },
    });
    userIds.set(u.username, user.id);
    userIdByEmployee.set(u.employee, user.id);

    const employeeId = employeeIds.get(u.employee)!;
    await prisma.employeeIdentity.upsert({
      where: { userId: user.id },
      update: { employeeId },
      create: { userId: user.id, employeeId },
    });
  }

  // 7. Rôles des comptes : exactement le rôle prévu (attribué par le premier SUPER_ADMIN)
  const assignedBy = userIds.get(data.users.find((u) => u.role === 'SUPER_ADMIN')!.username)!;
  for (const u of data.users) {
    const userId = userIds.get(u.username)!;
    const roleId = roleIds.get(u.role)!;
    await prisma.userRole.deleteMany({ where: { userId, roleId: { not: roleId } } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId, assignedBy },
    });
  }

  return { departmentIds, employeeIds, userIds, userIdByEmployee };
}
