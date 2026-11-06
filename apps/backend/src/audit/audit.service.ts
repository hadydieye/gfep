import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const AUDIT_FIELDS: Record<string, readonly string[]> = {
  Document: [
    'title',
    'categoryId',
    'ownerId',
    'mimeType',
    'fileSize',
    'confidentialityLevel',
    'validationStatus',
  ],
  DocumentPermission: ['documentId', 'userId', 'permission'],
  // exportFilters / exportedRows : audit d'un export CSV (N5), jamais les données exportées
  Transaction: ['reference', 'transactionType', 'amount', 'currency', 'status', 'departmentId', 'exportFilters', 'exportedRows'],
  Invoice: ['invoiceNumber', 'status', 'departmentId', 'exportFilters', 'exportedRows'],
  Employee: [
    'employeeNumber',
    'firstName',
    'lastName',
    'professionalEmail',
    'phone',
    'departmentId',
    'positionId',
    'managerId',
    'hireDate',
    'employmentStatus',
    'accountStatus',
    'revokedSessions',
  ],
  User: ['username', 'role', 'roles', 'status', 'failedLoginCount', 'revokedSessions'],
  Role: ['name', 'permissions'],
  AdGroupRoleMapping: ['adGroupDn', 'role'],
  // Paramètre système (N16) : clé et valeur (ancienne et nouvelle)
  SystemSetting: ['key', 'sessionTtlHours'],
};

export interface AuditEntry {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  sourceIp: string;
}

@Injectable()
export class AuditService {
  record(tx: Prisma.TransactionClient, entry: AuditEntry) {
    return tx.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        sourceIp: entry.sourceIp,
        oldValues: whitelistValues(entry.resourceType, entry.oldValues),
        newValues: whitelistValues(entry.resourceType, entry.newValues),
      },
    });
  }
}

function whitelistValues(
  resourceType: string,
  values?: Prisma.InputJsonValue,
): Prisma.InputJsonValue | undefined {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return undefined;
  const allowed = AUDIT_FIELDS[resourceType] ?? [];
  const filtered = Object.fromEntries(
    Object.entries(values).filter(([key]) => allowed.includes(key)),
  );
  return filtered as Prisma.InputJsonObject;
}