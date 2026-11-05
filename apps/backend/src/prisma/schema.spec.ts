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

  it('should not contain a hardcoded postgresql:// connection string', () => {
    expect(schemaContent).not.toMatch(/postgresql:\/\//);
  });

  it('should use env() for DATABASE_URL', () => {
    expect(schemaContent).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
  });
});
