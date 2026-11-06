import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { FINANCE_READ_ROLES, FINANCE_WRITE_ROLES, SUPER_ADMIN } from '../rbac/roles.js';
import { sendCsv } from './csv.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { ExportTransactionsQueryDto } from './dto/export-query.dto.js';
import { PaginatedTransactionsDto, TransactionResponseDto } from './dto/finance-response.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto.js';
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto.js';
import { TransactionsService } from './transactions.service.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles(...FINANCE_READ_ROLES)
  @Permission('transactions', 'read')
  findAll(
    @Query() query: ListTransactionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedTransactionsDto> {
    return this.transactionsService.findAll(query, user);
  }

  /** Export CSV (N5) : mêmes rôles, permission et scope que la liste. */
  @Get('export')
  @Roles(...FINANCE_READ_ROLES)
  @Permission('transactions', 'read')
  async export(
    @Query() query: ExportTransactionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return sendCsv(response, await this.transactionsService.export(query, user, request.ip ?? 'unknown'));
  }

  @Post()
  @Roles(...FINANCE_WRITE_ROLES)
  @Permission('transactions', 'write')
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(dto, user, request.ip ?? 'unknown');
  }

  @Patch(':id/status')
  @Roles(SUPER_ADMIN)
  @Permission('transactions', 'validate')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.updateStatus(id, dto, user, request.ip ?? 'unknown');
  }
}
