import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, Res, StreamableFile } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { FINANCE_READ_ROLES, FINANCE_WRITE_ROLES } from '../rbac/roles.js';
import { sendCsv } from './csv.js';
import { ExportInvoicesQueryDto } from './dto/export-query.dto.js';
import { InvoiceResponseDto, PaginatedInvoicesDto } from './dto/finance-response.dto.js';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto.js';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto.js';
import { InvoicesService } from './invoices.service.js';

// Factures en lecture seule, sauf le changement de statut (M14)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(...FINANCE_READ_ROLES)
  @Permission('invoices', 'read')
  findAll(
    @Query() query: ListInvoicesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedInvoicesDto> {
    return this.invoicesService.findAll(query, user);
  }

  /** Export CSV (N5), déclaré avant `:id`. Mêmes rôles, permission et scope que la liste. */
  @Get('export')
  @Roles(...FINANCE_READ_ROLES)
  @Permission('invoices', 'read')
  async export(
    @Query() query: ExportInvoicesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return sendCsv(response, await this.invoicesService.export(query, user, request.ip ?? 'unknown'));
  }

  @Get(':id')
  @Roles(...FINANCE_READ_ROLES)
  @Permission('invoices', 'read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.findOne(id, user);
  }

  @Patch(':id/status')
  @Roles(...FINANCE_WRITE_ROLES)
  @Permission('invoices', 'status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<InvoiceResponseDto> {
    return this.invoicesService.updateStatus(id, dto, user, request.ip ?? 'unknown');
  }
}
