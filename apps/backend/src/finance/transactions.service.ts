import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { financeScopeDepartmentId } from '../rbac/roles.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import type { FinanceUserDto } from './dto/finance-response.dto.js';
import { PaginatedTransactionsDto, TransactionResponseDto } from './dto/finance-response.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto.js';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto.js';
import { DEPARTMENT_SELECT, dateRange, financeAuditEntry, loadUsers } from './finance-common.js';
import {
  MAX_TRANSACTION_REFERENCE_ATTEMPTS,
  isUniqueViolationOn,
  nextTransactionReference,
} from './transaction-reference.js';

const TRANSACTION_INCLUDE = { department: DEPARTMENT_SELECT } satisfies Prisma.TransactionInclude;

type TransactionWithDepartment = Prisma.TransactionGetPayload<{ include: typeof TRANSACTION_INCLUDE }>;

export const STATE_CONFLICT_MESSAGE = "Cette action n'est pas possible dans l'état actuel.";

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: ListTransactionsQueryDto, user: AuthenticatedUser): Promise<PaginatedTransactionsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const scope = financeScopeDepartmentId(user);
    const search = query.search?.trim();

    // Scope DM dans la requête (M13) : les lignes sans département ne sont jamais visibles
    const where: Prisma.TransactionWhereInput = {
      AND: [
        scope ? { departmentId: scope } : {},
        query.departmentId ? { departmentId: query.departmentId } : {},
        query.type ? { transactionType: query.type } : {},
        query.status ? { status: query.status } : {},
        search ? { reference: { contains: search, mode: 'insensitive' } } : {},
        { createdAt: dateRange(query.from, query.to) },
      ],
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { reference: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    const users = await loadUsers(this.prisma, transactions.map((t) => t.createdBy));
    return { data: transactions.map((t) => toResponse(t, users)), total, page, limit };
  }

  async create(
    dto: CreateTransactionDto,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<TransactionResponseDto> {
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
      select: { id: true },
    });
    if (!department) throw new BusinessRuleException('Département inexistant.');

    for (let attempt = 1; ; attempt += 1) {
      try {
        const transaction = await this.prisma.$transaction(async (tx) => {
          const created = await tx.transaction.create({
            data: {
              reference: await nextTransactionReference(tx),
              transactionType: dto.transactionType,
              amount: new Prisma.Decimal(dto.amount),
              description: dto.description || null,
              departmentId: dto.departmentId,
              createdBy: user.id,
              status: TransactionStatus.PENDING,
            },
            include: TRANSACTION_INCLUDE,
          });
          await this.audit.record(tx, {
            ...financeAuditEntry(user, 'transaction.create', 'Transaction', created.id, sourceIp),
            newValues: auditValues(created),
          });
          return created;
        });
        return toResponse(transaction, new Map([[user.id, { id: user.id, username: user.username }]]));
      } catch (error) {
        if (!isUniqueViolationOn(error, 'reference')) throw error;
        if (attempt >= MAX_TRANSACTION_REFERENCE_ATTEMPTS) {
          throw new ConflictException("Impossible d'attribuer une référence de transaction. Réessayez.");
        }
      }
    }
  }

  /** Validation ou rejet par le SUPER_ADMIN, uniquement depuis PENDING (M14). */
  async updateStatus(
    id: string,
    dto: UpdateTransactionStatusDto,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Transaction introuvable.');
      if (existing.status !== TransactionStatus.PENDING) {
        throw new ConflictException(STATE_CONFLICT_MESSAGE);
      }
      // Condition sur le statut : deux décisions simultanées ne peuvent pas aboutir toutes les deux
      const updated = await tx.transaction.updateMany({
        where: { id, status: TransactionStatus.PENDING },
        data: { status: dto.status },
      });
      if (updated.count !== 1) throw new ConflictException(STATE_CONFLICT_MESSAGE);
      await this.audit.record(tx, {
        ...financeAuditEntry(user, 'transaction.status_change', 'Transaction', id, sourceIp),
        oldValues: { status: existing.status },
        newValues: { status: dto.status },
      });
      return tx.transaction.findUniqueOrThrow({ where: { id }, include: TRANSACTION_INCLUDE });
    });
    const users = await loadUsers(this.prisma, [transaction.createdBy]);
    return toResponse(transaction, users);
  }
}

function auditValues(transaction: TransactionWithDepartment): Prisma.InputJsonObject {
  return {
    reference: transaction.reference,
    transactionType: transaction.transactionType,
    amount: transaction.amount.toFixed(2),
    currency: transaction.currency,
    status: transaction.status,
    departmentId: transaction.departmentId,
  };
}

export function toResponse(
  transaction: TransactionWithDepartment,
  users: Map<string, FinanceUserDto>,
): TransactionResponseDto {
  return {
    id: transaction.id,
    reference: transaction.reference,
    transactionType: transaction.transactionType,
    amount: transaction.amount.toFixed(2),
    currency: transaction.currency,
    description: transaction.description,
    status: transaction.status,
    createdAt: transaction.createdAt.toISOString(),
    department: transaction.department,
    createdBy: users.get(transaction.createdBy) ?? null,
  };
}
