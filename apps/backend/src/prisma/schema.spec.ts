import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaPath = join(__dirname, '../../prisma/schema.prisma');
const schemaContent = readFileSync(schemaPath, 'utf-8');

const EXPECTED_MODELS = [
  'User',
  'EmployeeIdentity',
  'Session',
  'AdGroupRoleMapping',
  'Department',
  'Position',
  'Employee',
  'Role',
  'Permission',
  'UserRole',
  'RolePermission',
  'DocumentCategory',
  'Document',
  'DocumentPermission',
  'Transaction',
  'Invoice',
  'Notification',
  'AuthEvent',
  'AuditLog',
  'SecurityEvent',
  'LabScenario',
  'ScenarioExecution',
];

const EXPECTED_ENUMS = [
  'AuthProvider',
  'UserStatus',
  'EmploymentStatus',
  'ConfidentialityLevel',
  'DocumentPermissionType',
  'DocumentValidationStatus',
  'TransactionType',
  'TransactionStatus',
  'InvoiceStatus',
  'NotificationType',
  'AuthEventType',
  'SecuritySeverity',
];

describe('Prisma schema verification', () => {
  it('should contain all 22 model declarations', () => {
    for (const modelName of EXPECTED_MODELS) {
      expect(schemaContent, `Model "${modelName}" not found in schema.prisma`).toMatch(
        new RegExp(`^model ${modelName}\\s*\\{`, 'm'),
      );
    }
  });

  it('should have exactly 22 model declarations', () => {
    const modelMatches = schemaContent.match(/^model \w+\s*\{/gm);
    expect(modelMatches?.length).toBe(22);
  });

  it('should contain all 12 enum declarations', () => {
    for (const enumName of EXPECTED_ENUMS) {
      expect(schemaContent, `Enum "${enumName}" not found in schema.prisma`).toMatch(
        new RegExp(`^enum ${enumName}\\s*\\{`, 'm'),
      );
    }
  });

  it('should have exactly 12 enum declarations', () => {
    const enumMatches = schemaContent.match(/^enum \w+\s*\{/gm);
    expect(enumMatches?.length).toBe(12);
  });

  // Migration finance_department (gfep-mvp2/DECISIONS.md M13)
  it.each(['Transaction', 'Invoice'])(
    'model %s has a nullable, indexed departmentId related to Department',
    (modelName) => {
      const body = schemaContent.match(new RegExp(`^model ${modelName}\\s*\\{([\\s\\S]*?)^\\}`, 'm'))?.[1] ?? '';
      expect(body).toMatch(/^\s*departmentId\s+String\?\s*$/m);
      expect(body).toMatch(
        /^\s*department\s+Department\?\s+@relation\(fields: \[departmentId\], references: \[id\]\)/m,
      );
      expect(body).toMatch(/@@index\(\[departmentId\]\)/);
    },
  );

  it('model Department exposes its transactions and invoices', () => {
    const body = schemaContent.match(/^model Department\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(body).toMatch(/^\s*transactions\s+Transaction\[\]/m);
    expect(body).toMatch(/^\s*invoices\s+Invoice\[\]/m);
  });

  it('should not contain a hardcoded postgresql:// connection string', () => {
    expect(schemaContent).not.toMatch(/postgresql:\/\//);
  });

  it('should use env() for DATABASE_URL', () => {
    expect(schemaContent).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
  });
});
