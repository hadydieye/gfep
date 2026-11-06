import { OmitType } from '@nestjs/mapped-types';
import { ListInvoicesQueryDto } from './list-invoices-query.dto.js';
import { ListTransactionsQueryDto } from './list-transactions-query.dto.js';

/** Export CSV (N5) : mêmes filtres et tri que la liste, sans pagination. */
export class ExportTransactionsQueryDto extends OmitType(ListTransactionsQueryDto, ['page', 'limit'] as const) {}

export class ExportInvoicesQueryDto extends OmitType(ListInvoicesQueryDto, ['page', 'limit'] as const) {}
