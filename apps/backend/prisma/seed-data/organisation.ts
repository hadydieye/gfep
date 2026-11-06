/**
 * Organisation complète (gfep-mvp2/DECISIONS.md M3, M5) : 18 postes, 40 employés,
 * 40 comptes locaux. Étend MVP1_DATA sans le dupliquer ; toutes les personnes
 * sont fictives. Répartition : DG 4, RH 6, CF 8, IT 7, CO 9, AC 6.
 */
import type { EmployeeSeed, OrganisationDataset, PositionSeed, UserSeed } from '../seed-lib.js';
import { slug } from '../seed-lib.js';
import { MVP1_DATA } from '../seed-mvp1.js';

const EXTRA_POSITIONS: PositionSeed[] = [
  { title: 'Assistant(e) de direction', department: 'DG', hierarchyLevel: 3 },
  { title: 'Chargé(e) de mission', department: 'DG', hierarchyLevel: 2 },
  { title: 'Chargé(e) RH', department: 'RH', hierarchyLevel: 3 },
  { title: 'Assistant(e) RH', department: 'RH', hierarchyLevel: 4 },
  { title: 'Comptable', department: 'CF', hierarchyLevel: 3 },
  { title: 'Contrôleur de gestion', department: 'CF', hierarchyLevel: 3 },
  { title: 'Administrateur systèmes', department: 'IT', hierarchyLevel: 3 },
  { title: 'Technicien support', department: 'IT', hierarchyLevel: 4 },
  { title: 'Chargé(e) de clientèle', department: 'CO', hierarchyLevel: 3 },
  { title: 'Commercial terrain', department: 'CO', hierarchyLevel: 4 },
  { title: 'Auditeur', department: 'AC', hierarchyLevel: 3 },
  { title: 'Chargé(e) de conformité', department: 'AC', hierarchyLevel: 3 },
];

export const POSITIONS: PositionSeed[] = [...MVP1_DATA.positions, ...EXTRA_POSITIONS];

// Nouveau Directeur général et responsables de département (M5)
const CEO_NUMBER = 'GF-2026-007';
const DEPARTMENT_HEADS: Record<string, string> = {
  DG: CEO_NUMBER,
  RH: 'GF-2026-001',
  CF: 'GF-2026-002',
  IT: 'GF-2026-003',
  CO: 'GF-2026-006',
  AC: 'GF-2026-005',
};

// [prénom, nom, département, poste, date d'embauche] — numéros GF-2026-007 à 040, dans cet ordre
const NEW_EMPLOYEES: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['Thierno', 'Baldé', 'DG', 'Directeur général', '2014-01-06'],
  ['Mariama', 'Sylla', 'DG', 'Assistant(e) de direction', '2018-05-14'],
  ['Oumar', 'Kourouma', 'DG', 'Chargé(e) de mission', '2020-09-01'],
  ['Hawa', 'Condé', 'DG', 'Chargé(e) de mission', '2022-02-07'],
  ['Néné', 'Bah', 'RH', 'Chargé(e) RH', '2019-11-04'],
  ['Alseny', 'Cissé', 'RH', 'Chargé(e) RH', '2021-03-15'],
  ['Djénabou', 'Fofana', 'RH', 'Assistant(e) RH', '2022-06-20'],
  ['Sékouba', 'Traoré', 'RH', 'Assistant(e) RH', '2023-09-11'],
  ['Fanta', 'Kanté', 'RH', 'Chargé(e) RH', '2024-01-08'],
  ['Ibrahima', 'Sow', 'CF', 'Comptable', '2018-04-02'],
  ['Aminata', 'Diakité', 'CF', 'Comptable', '2019-07-22'],
  ['Lamine', 'Sacko', 'CF', 'Contrôleur de gestion', '2020-02-17'],
  ['Kadiatou', 'Haba', 'CF', 'Comptable', '2021-05-03'],
  ['Abdoulaye', 'Sangaré', 'CF', 'Contrôleur de gestion', '2022-08-29'],
  ['Binta', 'Yansané', 'CF', 'Comptable', '2023-03-13'],
  ['Moussa', 'Doré', 'CF', 'Comptable', '2024-05-06'],
  ['Fodé', 'Kaba', 'IT', 'Technicien support', '2021-10-04'],
  ['Aboubacar', 'Loua', 'IT', 'Technicien support', '2020-03-09'],
  ['Marie', 'Guilavogui', 'IT', 'Administrateur systèmes', '2022-01-17'],
  ['Jean', 'Kolié', 'IT', 'Technicien support', '2023-06-05'],
  ['Saran', 'Kamano', 'IT', 'Administrateur systèmes', '2024-02-12'],
  ['Ousmane', 'Millimono', 'CO', 'Chargé(e) de clientèle', '2018-08-20'],
  ['Aïcha', 'Tounkara', 'CO', 'Commercial terrain', '2019-04-15'],
  ['Sidiki', 'Koné', 'CO', 'Commercial terrain', '2020-10-26'],
  ['Mariame', 'Onivogui', 'CO', 'Chargé(e) de clientèle', '2021-07-12'],
  ['Boubacar', 'Béavogui', 'CO', 'Commercial terrain', '2022-03-28'],
  ['Rouguiatou', 'Doumbia', 'CO', 'Chargé(e) de clientèle', '2023-01-23'],
  ['Saliou', 'Diaby', 'CO', 'Commercial terrain', '2023-11-06'],
  ['Fatou', 'Bérété', 'CO', 'Chargé(e) de clientèle', '2024-04-15'],
  ['Souleymane', 'Touré', 'AC', 'Auditeur', '2019-09-16'],
  ['Hadja', 'Konaté', 'AC', 'Chargé(e) de conformité', '2020-12-07'],
  ['Alhassane', 'Diané', 'AC', 'Auditeur', '2022-04-25'],
  ['Mabinty', 'Kouyaté', 'AC', 'Chargé(e) de conformité', '2023-07-03'],
  ['Elhadj', 'Diawara', 'AC', 'Auditeur', '2024-06-17'],
];

function buildEmployees(): EmployeeSeed[] {
  // Mohamed Keïta quitte la Direction générale pour l'IT (M5)
  const mvp1 = MVP1_DATA.employees.map((e): EmployeeSeed =>
    e.number === 'GF-2026-004'
      ? { ...e, department: 'IT', position: 'Administrateur systèmes', managerNumber: DEPARTMENT_HEADS.IT }
      : { ...e, managerNumber: CEO_NUMBER },
  );

  const taken = new Set(mvp1.map((e) => e.email.split('@')[0]));
  const extra = NEW_EMPLOYEES.map(([firstName, lastName, department, position, hireDate], index) => {
    const number = `GF-2026-${String(index + 7).padStart(3, '0')}`;
    let username = `${slug(firstName)[0]}.${slug(lastName)}`;
    if (taken.has(username)) username = `${slug(firstName)}.${slug(lastName)}`;
    if (taken.has(username)) throw new Error(`Identifiant en double dans le seed : ${username}`);
    taken.add(username);
    const isHead = DEPARTMENT_HEADS[department] === number;
    return {
      number,
      firstName,
      lastName,
      email: `${username}@guineasf.com`,
      department,
      position,
      hireDate,
      managerNumber: number === CEO_NUMBER ? null : isHead ? CEO_NUMBER : DEPARTMENT_HEADS[department],
    } satisfies EmployeeSeed;
  });
  return [...mvp1, ...extra];
}

export const EMPLOYEES: EmployeeSeed[] = buildEmployees();

const DOCUMENT_PERMISSION_SEEDS = [
  { resource: 'documents', action: 'read', description: 'Consulter les documents autorisés' },
  { resource: 'documents', action: 'write', description: 'Déposer des documents' },
  { resource: 'documents', action: 'validate', description: 'Valider ou rejeter des documents' },
  { resource: 'documents', action: 'share', description: 'Gérer le partage des documents' },
  { resource: 'documents', action: 'delete', description: 'Supprimer les documents autorisés' },
] as const;

const DOCUMENT_PERMISSION_KEYS = DOCUMENT_PERMISSION_SEEDS.map(
  ({ resource, action }) => `${resource}:${action}`,
);

// Étape 2.3 : permissions finance (M24) et rôle ACCOUNTANT (M6)
const FINANCE_PERMISSION_SEEDS = [
  { resource: 'transactions', action: 'read', description: 'Consulter les transactions' },
  { resource: 'transactions', action: 'write', description: 'Créer des transactions' },
  { resource: 'transactions', action: 'validate', description: 'Valider ou rejeter des transactions' },
  { resource: 'invoices', action: 'read', description: 'Consulter les factures' },
  { resource: 'invoices', action: 'status', description: 'Changer le statut des factures' },
] as const;

const FINANCE_PERMISSION_KEYS = FINANCE_PERMISSION_SEEDS.map(
  ({ resource, action }) => `${resource}:${action}`,
);

// Étape 2.4 : permissions d'accès et changement de statut employé (M16, M17, M18, M24)
const ACCESS_PERMISSION_SEEDS = [
  { resource: 'employees', action: 'status', description: 'Suspendre, réactiver ou faire sortir un employé' },
  { resource: 'roles', action: 'read', description: 'Consulter les rôles et leurs permissions' },
  { resource: 'roles', action: 'write', description: 'Modifier les permissions d’un rôle' },
  { resource: 'users', action: 'read', description: 'Consulter les comptes applicatifs' },
  { resource: 'users', action: 'assign_role', description: 'Attribuer ou retirer des rôles' },
  { resource: 'users', action: 'suspend', description: 'Suspendre ou réactiver un compte' },
  { resource: 'users', action: 'unlock', description: 'Déverrouiller un compte verrouillé' },
] as const;

// Étape 2.5 : notifications propres à chaque utilisateur, pour les 8 rôles (M19, M24)
const NOTIFICATION_PERMISSION_SEEDS = [
  { resource: 'notifications', action: 'read', description: 'Consulter ses notifications' },
  { resource: 'notifications', action: 'update', description: 'Marquer ses notifications comme lues' },
] as const;

// Étape 2.6 : journaux d'audit, événements de sécurité, historique de consultation (M21, M24)
const AUDIT_PERMISSION_SEEDS = [
  { resource: 'audit', action: 'read', description: 'Consulter le journal d’audit et les authentifications' },
  { resource: 'security_events', action: 'read', description: 'Consulter les événements de sécurité' },
  { resource: 'documents', action: 'history', description: 'Consulter l’historique de consultation d’un document' },
] as const;

// Étape 2.7 : mappings groupe AD → rôle (M22, M24)
const AD_MAPPING_PERMISSION_SEEDS = [
  { resource: 'ad_mappings', action: 'read', description: 'Consulter les mappings groupe AD → rôle' },
  { resource: 'ad_mappings', action: 'write', description: 'Créer et supprimer des mappings groupe AD → rôle' },
] as const;

// Étape 3.2 : profil de l'utilisateur connecté (8 rôles) et paramètres système (SUPER_ADMIN) — N15, N16, N29
const PROFILE_PERMISSION_SEEDS = [
  { resource: 'profile', action: 'read', description: 'Consulter son propre profil' },
  { resource: 'profile', action: 'update', description: 'Changer son propre mot de passe' },
] as const;

const SETTINGS_PERMISSION_SEEDS = [
  { resource: 'settings', action: 'read', description: 'Consulter les paramètres de l’application' },
  { resource: 'settings', action: 'write', description: 'Modifier les paramètres de l’application' },
] as const;

const PERMISSION_SEEDS = [
  ...MVP1_DATA.permissions,
  ...DOCUMENT_PERMISSION_SEEDS,
  ...FINANCE_PERMISSION_SEEDS,
  ...ACCESS_PERMISSION_SEEDS,
  ...NOTIFICATION_PERMISSION_SEEDS,
  ...AUDIT_PERMISSION_SEEDS,
  ...AD_MAPPING_PERMISSION_SEEDS,
  ...PROFILE_PERMISSION_SEEDS,
  ...SETTINGS_PERMISSION_SEEDS,
];

// Les 8 rôles (M5, M6, M15) : 3 rôles MVP 1, ACCOUNTANT (2.3), 4 rôles ajoutés en 2.4
const ROLE_SEEDS = [
  ...MVP1_DATA.roles,
  { name: 'ACCOUNTANT', description: 'Comptable — gestion des transactions et des factures' },
  { name: 'IT_ADMINISTRATOR', description: 'Administrateur informatique — comptes, rôles et déverrouillage' },
  { name: 'IT_TECHNICIAN', description: 'Technicien informatique — consultation des employés et départements' },
  { name: 'HR_MANAGER', description: 'Responsable RH — gestion des fiches employés de tous les départements' },
  { name: 'AUDITOR', description: 'Auditeur — consultation, journaux d’audit à partir de l’étape 2.6' },
];

// Lecture de base, notifications et profil : communs aux 8 rôles
const READ_BASE = [
  'dashboard:read',
  'employees:read',
  'departments:read',
  'notifications:read',
  'notifications:update',
  'profile:read',
  'profile:update',
];
const DOCUMENTS_NO_VALIDATE = DOCUMENT_PERMISSION_KEYS.filter((key) => key !== 'documents:validate');

/**
 * Matrice rôle → permissions (design §2) : 34 permissions (M24, N29). Le SUPER_ADMIN détient toujours toutes
 * les permissions (M18), y compris `settings:*` qui lui sont réservées (N16).
 */
export const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  SUPER_ADMIN: PERMISSION_SEEDS.map(({ resource, action }) => `${resource}:${action}`),
  IT_ADMINISTRATOR: [
    ...READ_BASE,
    ...DOCUMENTS_NO_VALIDATE,
    'roles:read',
    'users:read',
    'users:assign_role',
    'users:suspend',
    'users:unlock',
    'ad_mappings:read',
    'ad_mappings:write',
  ],
  // M15 : lecture seule employés et départements, ses notifications ; ni documents, ni finance, ni accès
  IT_TECHNICIAN: [...READ_BASE],
  HR_MANAGER: [...READ_BASE, 'employees:write', 'employees:status', 'departments:write', ...DOCUMENTS_NO_VALIDATE],
  ACCOUNTANT: [
    ...READ_BASE,
    ...DOCUMENTS_NO_VALIDATE,
    ...FINANCE_PERMISSION_KEYS.filter((key) => key !== 'transactions:validate'),
  ],
  DEPARTMENT_MANAGER: [
    ...READ_BASE,
    'employees:write',
    'employees:status',
    ...DOCUMENT_PERMISSION_KEYS,
    'transactions:read',
    'invoices:read',
  ],
  EMPLOYEE: [...READ_BASE, ...DOCUMENTS_NO_VALIDATE],
  // Lecture du journal d'audit, des événements de sécurité et de l'historique de consultation (M21, M24)
  AUDITOR: [...READ_BASE, ...DOCUMENTS_NO_VALIDATE, 'audit:read', 'security_events:read', 'documents:history'],
};

// Comptes à l'étape 2.4 (M5) ; les autres comptes sont EMPLOYEE
const ROLE_BY_USERNAME: Record<string, string> = {
  't.balde': 'SUPER_ADMIN',
  'm.keita': 'IT_ADMINISTRATOR',
  'f.camara': 'HR_MANAGER',
  'a.barry': 'DEPARTMENT_MANAGER',
  'ibrahima.sow': 'ACCOUNTANT',
  's.toure': 'AUDITOR',
  'f.kaba': 'IT_TECHNICIAN',
};

// Identifiant = partie locale de l'e-mail professionnel (`initiale.nom`, ou `prenom.nom` en cas
// de collision, M5). Le SUPER_ADMIN est placé en premier : il attribue les rôles.
export const USERS: UserSeed[] = EMPLOYEES.map((e) => {
  const username = e.email.split('@')[0];
  return { username, employee: e.number, role: ROLE_BY_USERNAME[username] ?? 'EMPLOYEE' };
}).sort((a, b) => Number(b.role === 'SUPER_ADMIN') - Number(a.role === 'SUPER_ADMIN'));

export const ORGANISATION: OrganisationDataset = {
  ...MVP1_DATA,
  roles: ROLE_SEEDS,
  permissions: PERMISSION_SEEDS,
  rolePermissions: ROLE_PERMISSIONS,
  positions: POSITIONS,
  employees: EMPLOYEES,
  departmentManagers: DEPARTMENT_HEADS,
  users: USERS,
};

export const DOCUMENT_CATEGORIES = [
  { name: 'Direction générale', department: 'DG', description: 'Notes de direction, stratégie, comités' },
  { name: 'Ressources humaines', department: 'RH', description: 'Politiques RH, contrats types, formation' },
  { name: 'Comptabilité', department: 'CF', description: 'États financiers, budgets, procédures comptables' },
  { name: 'Informatique', department: 'IT', description: 'Procédures techniques, architecture, sécurité' },
  { name: 'Commercial', department: 'CO', description: 'Offres, catalogues, rapports commerciaux' },
  { name: 'Audit et conformité', department: 'AC', description: 'Rapports d’audit, contrôles, conformité' },
] as const;
