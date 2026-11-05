/**
 * Seed complet GFEP (gfep-mvp2/DECISIONS.md M3, M4, M5, M10), commande
 * `npx prisma db seed`. Étend le jeu MVP 1 sans doublon : 6 départements,
 * 18 postes, 40 employés, 40 comptes locaux, 6 catégories, 50 documents avec
 * fichiers réels, 30 factures, 100 transactions. Rôles : les 3 rôles MVP 1
 * à l'étape 2.1 (étendus en 2.3 et 2.4).
 *
 * Idempotent. Réservé au développement : refuse NODE_ENV=production. Les mots
 * de passe de démonstration (SEED_PASSWORD_<ROLE>) ne sont jamais loggés.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { DOCUMENTS, DOCUMENT_SHARES } from './seed-data/documents.js';
import { INVOICES, TRANSACTIONS } from './seed-data/finance.js';
import { DOCUMENT_CATEGORIES, ORGANISATION } from './seed-data/organisation.js';
import { MIME_TYPES, documentsStorageDir, ensureSeedFile } from './seed-files.js';
import { SeededOrganisation, assertNotProduction, hashRolePasswords, seedOrganisation } from './seed-lib.js';

async function seedDocuments(prisma: PrismaClient, org: SeededOrganisation) {
  const categoryIds = new Map<string, string>();
  for (const c of DOCUMENT_CATEGORIES) {
    const departmentId = org.departmentIds.get(c.department)!;
    const category = await prisma.documentCategory.upsert({
      where: { name: c.name },
      update: { description: c.description, departmentId },
      create: { name: c.name, description: c.description, departmentId },
    });
    categoryIds.set(c.department, category.id);
  }

  // Propriétaires : employés du département de la catégorie, par numéro croissant
  const employeesByDepartment = new Map<string, string[]>();
  for (const e of ORGANISATION.employees) {
    const list = employeesByDepartment.get(e.department) ?? [];
    list.push(e.number);
    employeesByDepartment.set(e.department, list);
  }

  const documentIds = new Map<string, { id: string; ownerNumber: string }>();
  for (const d of DOCUMENTS) {
    const members = employeesByDepartment.get(d.category)!;
    const ownerNumber = members[d.ownerRank % members.length];
    const ownerId = org.employeeIds.get(ownerNumber)!;
    const existing = await prisma.document.findFirst({ where: { title: d.title, ownerId } });
    // Un document existant garde son fichier ; seul un fichier manquant est régénéré
    const storagePath = existing?.storagePath ?? randomUUID();
    const fields = {
      description: `Document de démonstration — ${d.title}. Données fictives.`,
      categoryId: categoryIds.get(d.category)!,
      storagePath,
      mimeType: MIME_TYPES[d.format],
      fileSize: ensureSeedFile(storagePath, d.format, d.title),
      confidentialityLevel: d.level,
      validationStatus: d.validationStatus,
    };
    const document = existing
      ? await prisma.document.update({ where: { id: existing.id }, data: fields })
      : await prisma.document.create({ data: { title: d.title, ownerId, ...fields } });
    documentIds.set(d.title, { id: document.id, ownerNumber });
  }

  for (const share of DOCUMENT_SHARES) {
    const { id: documentId, ownerNumber } = documentIds.get(share.title)!;
    const userId = org.userIdByEmployee.get(share.employee)!;
    await prisma.documentPermission.upsert({
      where: { documentId_userId_permission: { documentId, userId, permission: share.permission } },
      update: {},
      create: {
        documentId,
        userId,
        permission: share.permission,
        grantedBy: org.userIdByEmployee.get(ownerNumber)!,
      },
    });
  }
}

async function seedFinance(prisma: PrismaClient, org: SeededOrganisation) {
  const createdBy = org.userIds.get('m.keita')!;
  for (const i of INVOICES) {
    const fields = {
      clientName: i.clientName,
      amount: i.amount,
      dueDate: new Date(i.dueDate),
      status: i.status,
      createdAt: new Date(i.createdAt),
    };
    await prisma.invoice.upsert({
      where: { invoiceNumber: i.invoiceNumber },
      update: fields,
      create: { invoiceNumber: i.invoiceNumber, createdBy, ...fields },
    });
  }
  for (const t of TRANSACTIONS) {
    const fields = {
      transactionType: t.transactionType,
      amount: t.amount,
      description: t.description,
      status: t.status,
      createdAt: new Date(t.createdAt),
    };
    await prisma.transaction.upsert({
      where: { reference: t.reference },
      update: fields,
      create: { reference: t.reference, createdBy, ...fields },
    });
  }
}

async function main() {
  assertNotProduction('Seed complet');
  const prisma = new PrismaClient();
  try {
    const hashes = await hashRolePasswords(ORGANISATION.roles.map((r) => r.name));
    const org = await seedOrganisation(prisma, ORGANISATION, hashes);
    await seedDocuments(prisma, org);
    await seedFinance(prisma, org);

    const counts = {
      départements: await prisma.department.count(),
      postes: await prisma.position.count(),
      employés: await prisma.employee.count(),
      utilisateurs: await prisma.user.count(),
      rôles: await prisma.role.count(),
      permissions: await prisma.permission.count(),
      catégories: await prisma.documentCategory.count(),
      documents: await prisma.document.count(),
      factures: await prisma.invoice.count(),
      transactions: await prisma.transaction.count(),
    };
    console.log(
      `Seed complet terminé : ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}. ` +
        `Fichiers sous ${documentsStorageDir()}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
