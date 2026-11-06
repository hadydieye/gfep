import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AuditService } from '../audit/audit.service.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildOrderBy } from '../common/sorting.js';
import {
  INVOICE_DEFAULT_ORDER,
  INVOICE_SORTS,
  INVOICE_SORT_TIEBREAKER,
} from './finance-sorting.js';
import { financeScopeDepartmentId } from '../rbac/roles.js';
import type { FinanceUserDto } from './dto/finance-response.dto.js';
import { InvoiceResponseDto, PaginatedInvoicesDto } from './dto/finance-response.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import type { ExportInvoicesQueryDto } from './dto/export-query.dto.js';
import {
  EXPORT_TOO_LARGE_MESSAGE,
  INVOICE_STATUS_LABELS,
  MAX_EXPORT_ROWS,
  fileStamp,
  formatDateIso,
  formatDecimalFr,
  toCsv,
} from './csv.js';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto.js';
import {
  DEPARTMENT_SELECT,
  dateRange,
  financeAuditEntry,
  hasPermission,
  loadUsers,
} from './finance-common.js';
import {
  FORBIDDEN_INVOICE_TRANSITION_MESSAGE,
  INVOICE_TRANSITIONS,
  canTransitionInvoice,
} from './invoice-transitions.js';
import { STATE_CONFLICT_MESSAGE } from './transactions.service.js';

const INVOICE_INCLUDE = { department: DEPARTMENT_SELECT } satisfies Prisma.InvoiceInclude;

type InvoiceWithDepartment = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    query: ListInvoicesQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedInvoicesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where = listWhere(query, user);

    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: buildOrderBy(query, INVOICE_SORTS, INVOICE_SORT_TIEBREAKER, INVOICE_DEFAULT_ORDER),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    const users = await loadUsers(
      this.prisma,
      invoices.map((i) => i.createdBy),
    );
    return { data: invoices.map((i) => toResponse(i, users, user)), total, page, limit };
  }

  /**
   * Export CSV (N5) : toutes les factures des filtres et du tri de la liste,
   * scope DM compris, au plus 10 000. Audit `invoice.export`.
   */
  async export(
    query: ExportInvoicesQueryDto,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<{ filename: string; content: string }> {
    const where = listWhere(query, user);
    if ((await this.prisma.invoice.count({ where })) > MAX_EXPORT_ROWS) {
      throw new BusinessRuleException(EXPORT_TOO_LARGE_MESSAGE);
    }
    const rows = await this.prisma.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: buildOrderBy(query, INVOICE_SORTS, INVOICE_SORT_TIEBREAKER, INVOICE_DEFAULT_ORDER),
    });
    const content = toCsv(
      EXPORT_HEADERS,
      rows.map((i) => [
        i.invoiceNumber,
        i.clientName,
        formatDecimalFr(i.amount.toFixed(2)),
        i.currency,
        formatDateIso(i.dueDate),
        INVOICE_STATUS_LABELS[i.status],
        i.department?.name ?? '',
        formatDateIso(i.createdAt),
      ]),
    );
    await this.prisma.$transaction((tx) =>
      this.audit.record(tx, {
        ...financeAuditEntry(user, 'invoice.export', 'Invoice', 'export', sourceIp),
        newValues: { exportFilters: exportFilters(query), exportedRows: rows.length },
      }),
    );
    return { filename: `factures-${fileStamp()}.csv`, content };
  }

  /** Détail ; hors du scope DM, la facture est traitée comme inexistante (404). */
  async findOne(id: string, user: AuthenticatedUser): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { AND: [{ id }, scopeWhere(user)] },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException('Facture introuvable.');
    const users = await loadUsers(this.prisma, [invoice.createdBy]);
    return toResponse(invoice, users, user);
  }

  /** Changement de statut par l'ACCOUNTANT ou le SUPER_ADMIN, selon les transitions de M14. */
  async updateStatus(
    id: string,
    dto: UpdateInvoiceStatusDto,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findFirst({ where: { AND: [{ id }, scopeWhere(user)] } });
      if (!existing) throw new NotFoundException('Facture introuvable.');
      if (!canTransitionInvoice(existing.status, dto.status)) {
        throw new BusinessRuleException(FORBIDDEN_INVOICE_TRANSITION_MESSAGE);
      }
      // Condition sur le statut lu : un changement concurrent fait échouer celui-ci
      const updated = await tx.invoice.updateMany({
        where: { id, status: existing.status },
        data: { status: dto.status },
      });
      if (updated.count !== 1) throw new ConflictException(STATE_CONFLICT_MESSAGE);
      await this.audit.record(tx, {
        ...financeAuditEntry(user, 'invoice.status_change', 'Invoice', id, sourceIp),
        oldValues: { invoiceNumber: existing.invoiceNumber, status: existing.status },
        newValues: { invoiceNumber: existing.invoiceNumber, status: dto.status },
      });
      return tx.invoice.findUniqueOrThrow({ where: { id }, include: INVOICE_INCLUDE });
    });
    const users = await loadUsers(this.prisma, [invoice.createdBy]);
    return toResponse(invoice, users, user);
  }
}

// Scope DM (M13) inclus dans la requête : les factures sans département ne sont jamais visibles
function scopeWhere(user: AuthenticatedUser): Prisma.InvoiceWhereInput {
  const scope = financeScopeDepartmentId(user);
  return scope ? { departmentId: scope } : {};
}

function toResponse(
  invoice: InvoiceWithDepartment,
  users: Map<string, FinanceUserDto>,
  user: AuthenticatedUser,
): InvoiceResponseDto {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    amount: invoice.amount.toFixed(2),
    currency: invoice.currency,
    dueDate: invoice.dueDate.toISOString(),
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString(),
    department: invoice.department,
    createdBy: users.get(invoice.createdBy) ?? null,
    allowedTransitions: hasPermission(user, 'invoices', 'status')
      ? [...INVOICE_TRANSITIONS[invoice.status]]
      : ([] as InvoiceStatus[]),
  };
}

type InvoiceFilters = Omit<ListInvoicesQueryDto, 'page' | 'limit'>;

const EXPORT_HEADERS = [
  'Numéro',
  'Client',
  'Montant',
  'Devise',
  'Échéance',
  'Statut',
  'Département',
  'Créée le',
];

/** Filtres de la liste et de l'export, scope DM compris (M13). */
function listWhere(query: InvoiceFilters, user: AuthenticatedUser): Prisma.InvoiceWhereInput {
  const search = query.search?.trim();
  return {
    AND: [
      scopeWhere(user),
      query.departmentId ? { departmentId: query.departmentId } : {},
      query.status ? { status: query.status } : {},
      search ? { clientName: { contains: search, mode: 'insensitive' } } : {},
      { dueDate: dateRange(query.dueFrom, query.dueTo) },
    ],
  };
}

/** Filtres effectivement appliqués, pour l'audit d'un export (valeurs vides omises). */
function exportFilters(query: InvoiceFilters): Record<string, string> {
  const entries = Object.entries({
    status: query.status,
    departmentId: query.departmentId,
    dueFrom: query.dueFrom,
    dueTo: query.dueTo,
    search: query.search?.trim(),
    sort: query.sort,
    order: query.sort ? (query.order ?? 'asc') : undefined,
  }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');
  return Object.fromEntries(entries);
}
