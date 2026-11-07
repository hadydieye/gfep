import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Permission } from '../rbac/decorators/permission.decorator.js';
import { Roles } from '../rbac/decorators/roles.decorator.js';
import { AUDIT_ROLES, DOCUMENT_ROLES, DOCUMENT_VALIDATE_ROLES } from '../rbac/roles.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import {
  DocumentCategoryDto,
  DocumentHistoryEntryDto,
  DocumentPermissionResponseDto,
  DocumentResponseDto,
  DocumentShareRecipientDto,
  PaginatedDocumentsDto,
} from './dto/document-response.dto.js';
import { GrantPermissionDto } from './dto/grant-permission.dto.js';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';
import { UpdateValidationDto } from './dto/update-validation.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { DocumentCommentDto } from './dto/document-comment.dto.js';
import { DocumentsService } from './documents.service.js';
import { convertDocument } from './document-convert.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  findAll(
    @Query() query: ListDocumentsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedDocumentsDto> {
    return this.documentsService.findAll(query, user);
  }

  @Get('categories')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  findCategories(@CurrentUser() user: AuthenticatedUser): Promise<DocumentCategoryDto[]> {
    return this.documentsService.findCategories(user);
  }

  @Get(':id')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.findOne(id, user, request.ip ?? 'unknown');
  }

  // Historique de consultation (R28.4) : SUPER_ADMIN et AUDITOR (M24)
  @Get(':id/history')
  @Roles(...AUDIT_ROLES)
  @Permission('documents', 'history')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentHistoryEntryDto[]> {
    return this.documentsService.getHistory(id, user);
  }

  @Get(':id/download')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<StreamableFile> {
    const file = await this.documentsService.getFile(id, user, request.ip ?? 'unknown', false);
    request.res?.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      length: file.buffer.length,
    });
  }

  @Get(':id/preview')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<StreamableFile> {
    const file = await this.documentsService.getFile(id, user, request.ip ?? 'unknown', true);
    request.res?.setHeader('X-Content-Type-Options', 'nosniff');
    request.res?.setHeader('Content-Security-Policy', 'sandbox');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: 'inline',
      length: file.buffer.length,
    });
  }

  // GFEP-670 : fil de commentaires sur un document (AppFlow §3.8)
  @Get(':id/comments')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  listComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentCommentDto[]> {
    return this.documentsService.listComments(id, user);
  }

  @Post(':id/comments')
  @HttpCode(201)
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  createComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DocumentCommentDto> {
    return this.documentsService.createComment(id, dto.content, user, request.ip ?? 'unknown');
  }

  // GFEP-541 : conversion d'un document vers un autre format (support outil natif)
  @Post(':id/convert')
  @HttpCode(200)
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'read')
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('format') format: string,
  ): Promise<{ format: string; output: string; exitCode: number | null }> {
    return convertDocument(format ?? 'pdf');
  }

  @Post()
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'write')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.create(dto, file, user, request.ip ?? 'unknown');
  }

  @Patch(':id/validation')
  @Roles(...DOCUMENT_VALIDATE_ROLES)
  @Permission('documents', 'validate')
  updateValidation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateValidationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.updateValidation(id, dto, user, request.ip ?? 'unknown');
  }

  @Get(':id/permissions')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'share')
  getPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentPermissionResponseDto[]> {
    return this.documentsService.getPermissions(id, user);
  }

  @Get(':id/share-recipients')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'share')
  getShareRecipients(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentShareRecipientDto[]> {
    return this.documentsService.getShareRecipients(id, user);
  }

  @Post(':id/permissions')
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'share')
  grantPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<DocumentPermissionResponseDto> {
    return this.documentsService.grantPermission(id, dto, user, request.ip ?? 'unknown');
  }

  @Delete(':id/permissions/:permissionId')
  @HttpCode(204)
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'share')
  revokePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<void> {
    return this.documentsService.revokePermission(id, permissionId, user, request.ip ?? 'unknown');
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...DOCUMENT_ROLES)
  @Permission('documents', 'delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<void> {
    return this.documentsService.remove(id, user, request.ip ?? 'unknown');
  }
}