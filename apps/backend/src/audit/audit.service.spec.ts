import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuditService } from './audit.service.js';

describe('AuditService', () => {
  it('only persists whitelisted resource fields', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const service = new AuditService();
    const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;

    await service.record(tx, {
      actorId: 'actor-id',
      action: 'document.validate',
      resourceType: 'Document',
      resourceId: 'document-id',
      sourceIp: '127.0.0.1',
      oldValues: { validationStatus: 'PENDING', password: 'must-not-be-recorded' },
      newValues: { validationStatus: 'VALIDATED', sessionToken: 'must-not-be-recorded' },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: 'actor-id',
        action: 'document.validate',
        resourceType: 'Document',
        resourceId: 'document-id',
        sourceIp: '127.0.0.1',
        oldValues: { validationStatus: 'PENDING' },
        newValues: { validationStatus: 'VALIDATED' },
      },
    });
  });
});