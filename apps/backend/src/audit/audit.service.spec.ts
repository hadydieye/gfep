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

  it('whitelists Transaction and Invoice fields (étape 2.3)', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const service = new AuditService();
    const tx = { auditLog: { create } } as unknown as Prisma.TransactionClient;

    await service.record(tx, {
      actorId: 'actor-id',
      action: 'transaction.create',
      resourceType: 'Transaction',
      resourceId: 'transaction-id',
      sourceIp: '127.0.0.1',
      newValues: { reference: 'TRX-2026-00001', amount: '10.00', status: 'PENDING', createdBy: 'x' },
    });
    await service.record(tx, {
      actorId: 'actor-id',
      action: 'invoice.status_change',
      resourceType: 'Invoice',
      resourceId: 'invoice-id',
      sourceIp: '127.0.0.1',
      oldValues: { status: 'SENT', clientName: 'not-recorded' },
      newValues: { status: 'PAID' },
    });

    expect(create.mock.calls[0][0].data.newValues).toEqual({
      reference: 'TRX-2026-00001',
      amount: '10.00',
      status: 'PENDING',
    });
    expect(create.mock.calls[1][0].data.oldValues).toEqual({ status: 'SENT' });
  });
});
