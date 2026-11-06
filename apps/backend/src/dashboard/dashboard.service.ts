import { Injectable } from '@nestjs/common';
import {
  DocumentValidationStatus,
  EmploymentStatus,
  InvoiceStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCOUNTANT, DEPARTMENT_MANAGER, SUPER_ADMIN, primaryRole } from '../rbac/roles.js';
import { buildVisibilityWhere } from '../documents/document-access.js';
import { DashboardResponseDto } from './dto/dashboard-response.dto.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getIndicators(user: AuthenticatedUser): Promise<DashboardResponseDto> {
    const role = primaryRole(user);
    const indicators: DashboardResponseDto['indicators'] = {};

    if (role === SUPER_ADMIN) {
      indicators.totalEmployees = await this.prisma.employee.count({
        where: { employmentStatus: EmploymentStatus.ACTIVE },
      });
    } else if (role === DEPARTMENT_MANAGER && user.employeeIdentity) {
      const department = await this.prisma.department.findUnique({
        where: { id: user.employeeIdentity.departmentId },
        select: {
          name: true,
          _count: {
            select: { employees: { where: { employmentStatus: EmploymentStatus.ACTIVE } } },
          },
        },
      });
      if (department) {
        indicators.departmentEmployees = department._count.employees;
        indicators.departmentName = department.name;
      }
    }

    const [recentDocuments, pendingDocuments] = await Promise.all([
      role === 'EMPLOYEE'
        ? this.prisma.document.findMany({
            where: buildVisibilityWhere(user),
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : Promise.resolve(undefined),
      role === DEPARTMENT_MANAGER && user.employeeIdentity
        ? this.prisma.document.findMany({
            where: {
              AND: [
                buildVisibilityWhere(user),
                { validationStatus: DocumentValidationStatus.PENDING },
                {
                  OR: [
                    { category: { is: { departmentId: user.employeeIdentity.departmentId } } },
                    {
                      category: { is: { departmentId: null } },
                      owner: { is: { departmentId: user.employeeIdentity.departmentId } },
                    },
                  ],
                },
              ],
            },
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve(undefined),
    ]);

    const finance = role === ACCOUNTANT ? await this.accountantCards() : undefined;
    if (finance) Object.assign(indicators, finance.indicators);

    return {
      role,
      indicators,
      recentActivity: [],
      ...(finance
        ? { recentTransactions: finance.recentTransactions, pendingInvoices: finance.pendingInvoices }
        : {}),
      ...(recentDocuments ? { recentDocuments: recentDocuments.map(withIsoDate) } : {}),
      ...(pendingDocuments ? { pendingDocuments: pendingDocuments.map(withIsoDate) } : {}),
    };
  }

  private async accountantCards() {
    const { start, end, month } = currentMonthBounds();
    const pendingWhere = { status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } };
    const validatedInMonth = (transactionType: TransactionType) =>
      this.prisma.transaction.aggregate({
        where: { transactionType, status: TransactionStatus.VALIDATED, createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
      });
    const [transactions, invoices, pendingInvoicesTotal, income, expense] = await Promise.all([
      this.prisma.transaction.findMany({
        orderBy: [{ createdAt: 'desc' }, { reference: 'desc' }],
        take: 5,
      }),
      this.prisma.invoice.findMany({
        where: pendingWhere,
        orderBy: [{ dueDate: 'asc' }, { invoiceNumber: 'asc' }],
        take: 5,
      }),
      this.prisma.invoice.count({ where: pendingWhere }),
      validatedInMonth(TransactionType.INCOME),
      validatedInMonth(TransactionType.EXPENSE),
    ]);
    return {
      indicators: {
        month,
        monthIncome: (income._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        monthExpense: (expense._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
        pendingInvoicesTotal,
      },
      recentTransactions: transactions.map((t) => ({
        id: t.id,
        reference: t.reference,
        transactionType: t.transactionType,
        amount: t.amount.toFixed(2),
        currency: t.currency,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
      pendingInvoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        amount: i.amount.toFixed(2),
        currency: i.currency,
        dueDate: i.dueDate.toISOString(),
        status: i.status,
      })),
    };
  }
}

// Cartes de l'ACCOUNTANT (AppFlow §5, design §5.3) : montants en chaîne, jamais en flottant
export function currentMonthBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, month: start.toISOString().slice(0, 7) };
}

function withIsoDate(document: { id: string; title: string; createdAt: Date }) {
  return { ...document, createdAt: document.createdAt.toISOString() };
}
