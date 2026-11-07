import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConfidentialityLevel,
  DocumentPermissionType,
  DocumentValidationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { BusinessRuleException } from '../common/invalid-data.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildOrderBy } from '../common/sorting.js';
import { DOCUMENT_DEFAULT_ORDER, DOCUMENT_SORTS, DOCUMENT_SORT_TIEBREAKER } from './document-sorting.js';
import type { CreateDocumentDto } from './dto/create-document.dto.js';
import type {
  DocumentCategoryDto,
  DocumentHistoryEntryDto,
  DocumentPermissionResponseDto,
  DocumentResponseDto,
  DocumentShareRecipientDto,
  PaginatedDocumentsDto,
} from './dto/document-response.dto.js';
import type { GrantPermissionDto } from './dto/grant-permission.dto.js';
import type { DocumentCommentDto } from './dto/document-comment.dto.js';
import type { ListDocumentsQueryDto } from './dto/list-documents-query.dto.js';
import type { UpdateValidationDto } from './dto/update-validation.dto.js';
import {
  buildDownloadVisibilityWhere,
  buildVisibilityWhere,
  canDelete,
  canShare,
  canValidate,
} from './document-access.js';
import { deleteDocumentFile, readDocumentFile, writeDocumentFile } from './document-storage.js';
import { detectAllowedFileType, previewableMimeType } from './file-signature.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCUMENT_INCLUDE = {
  category: { select: { id: true, name: true, departmentId: true, department: { select: { id: true, name: true } } } },
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
  },
  permissions: { select: { userId: true, permission: true } },
} satisfies Prisma.DocumentInclude;
type DocumentWithRelations = Prisma.DocumentGetPayload<{ include: typeof DOCUMENT_INCLUDE }>;
type DocumentPermissionRecord = Prisma.DocumentPermissionGetPayload<Record<string, never>>;
type UserForPermission = {
  id: string;
  username: string;
  employeeIdentity: { employee: { firstName: string; lastName: string } } | null;
};

const SHARE_LABELS: Record<DocumentPermissionType, string> = {
  READ: 'lecture',
  WRITE: 'écriture',
  DELETE: 'suppression',
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(query: ListDocumentsQueryDto, user: AuthenticatedUser): Promise<PaginatedDocumentsDto> {
    const where: Prisma.DocumentWhereInput = {
      AND: [
        buildVisibilityWhere(user),
        {
          categoryId: query.categoryId,
          confidentialityLevel: query.confidentialityLevel,
          validationStatus: query.validationStatus,
          title: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
          ownerId: query.ownerId,
        },
        // Département au sens de M8 : celui de la catégorie, à défaut celui du propriétaire
        query.departmentId
          ? {
              OR: [
                { category: { departmentId: query.departmentId } },
                { category: { departmentId: null }, owner: { departmentId: query.departmentId } },
              ],
            }
          : {},
      ],
    };
    const [documents, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: DOCUMENT_INCLUDE,
        orderBy: buildOrderBy(query, DOCUMENT_SORTS, DOCUMENT_SORT_TIEBREAKER, DOCUMENT_DEFAULT_ORDER),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.document.count({ where }),
    ]);
    return {
      data: documents.map((document) => toResponse(document, user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findCategories(user: AuthenticatedUser): Promise<DocumentCategoryDto[]> {
    const categories = await this.prisma.documentCategory.findMany({
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      department: category.department,
      canUpload:
        user.roles.includes('SUPER_ADMIN') ||
        category.departmentId === null ||
        category.departmentId === user.employeeIdentity?.departmentId,
    }));
  }

  async findOne(id: string, user: AuthenticatedUser, sourceIp: string): Promise<DocumentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: { AND: [{ id }, buildVisibilityWhere(user)] },
        include: DOCUMENT_INCLUDE,
      });
      if (!document) throw new NotFoundException('Document introuvable.');
      if (isSensitive(document.confidentialityLevel)) {
        await this.audit.record(tx, auditEntry(user, 'document.view', document.id, sourceIp));
      }
      return toResponse(document, user);
    });
  }

  async getFile(
    id: string,
    user: AuthenticatedUser,
    sourceIp: string,
    preview: boolean,
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const document = await this.prisma.document.findFirst({
      where: { AND: [{ id }, buildDownloadVisibilityWhere(user)] },
      include: DOCUMENT_INCLUDE,
    });
    if (!document) throw new NotFoundException('Document introuvable.');
    if (preview && !previewableMimeType(document.mimeType)) {
      throw new NotFoundException('Aperçu indisponible.');
    }
    const buffer = await readDocumentFile(document.storagePath);
    if (isSensitive(document.confidentialityLevel)) {
      await this.prisma.$transaction((tx) =>
        this.audit.record(
          tx,
          auditEntry(user, preview ? 'document.view' : 'document.download', document.id, sourceIp),
        ),
      );
    }
    return {
      buffer,
      mimeType: document.mimeType,
      filename: `${safeFilename(document.title)}.${extensionForMime(document.mimeType)}`,
    };
  }

  async create(
    dto: CreateDocumentDto,
    file: { buffer: Buffer; size: number; mimetype?: string } | undefined,
    user: AuthenticatedUser,
    _sourceIp: string,
  ): Promise<DocumentResponseDto> {
    if (!file) throw new BusinessRuleException('Un fichier est obligatoire.');
    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new BusinessRuleException('Fichier trop volumineux (10 Mo maximum).');
    }
    // GFEP-533 : on fait confiance au Content-Type envoyé par le navigateur
    // pour éviter une double lecture binaire du fichier à l'upload.
    // Repli sur file-type si le client n'a rien envoyé.
    let mimeType: string;
    if (file.mimetype && file.mimetype !== 'application/octet-stream') {
      mimeType = file.mimetype;
    } else {
      const detected = await detectAllowedFileType(file.buffer);
      if (!detected) throw new BusinessRuleException('Format de fichier non pris en charge.');
      mimeType = detected.mimeType;
    }
    if (!user.employeeIdentity) throw new ForbiddenException();

    const [category, owner] = await Promise.all([
      this.prisma.documentCategory.findUnique({ where: { id: dto.categoryId } }),
      this.prisma.employee.findUnique({ where: { id: user.employeeIdentity.employeeId } }),
    ]);
    if (!category || !owner) throw new BusinessRuleException('Catégorie de document invalide.');
    if (
      !user.roles.includes('SUPER_ADMIN') &&
      category.departmentId !== null &&
      category.departmentId !== user.employeeIdentity.departmentId
    ) {
      throw new ForbiddenException();
    }

    const storagePath = await writeDocumentFile(file.buffer);
    try {
      const document = await this.prisma.document.create({
        data: {
          title: dto.title,
          description: dto.description,
          categoryId: category.id,
          ownerId: owner.id,
          storagePath,
          mimeType,
          fileSize: file.buffer.length,
          confidentialityLevel: dto.confidentialityLevel,
          validationStatus: DocumentValidationStatus.PENDING,
        },
        include: DOCUMENT_INCLUDE,
      });
      return toResponse(document, user);
    } catch (error) {
      await deleteDocumentFile(storagePath).catch(() => undefined);
      throw error;
    }
  }

  async updateValidation(
    id: string,
    dto: UpdateValidationDto,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<DocumentResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: { AND: [{ id }, buildVisibilityWhere(user)] },
        include: DOCUMENT_INCLUDE,
      });
      if (!document) throw new NotFoundException('Document introuvable.');
      if (!canValidate(document, user)) throw new ForbiddenException();
      if (document.validationStatus !== DocumentValidationStatus.PENDING) {
        throw new ConflictException('Ce document a déjà été traité.');
      }
      const updated = await tx.document.updateMany({
        where: { id, validationStatus: DocumentValidationStatus.PENDING },
        data: { validationStatus: dto.status },
      });
      if (updated.count !== 1) throw new ConflictException('Ce document a déjà été traité.');
      const saved = await tx.document.findUniqueOrThrow({ where: { id }, include: DOCUMENT_INCLUDE });
      await this.audit.record(tx, {
        ...auditEntry(user, 'document.validate', id, sourceIp),
        oldValues: { validationStatus: document.validationStatus },
        newValues: { validationStatus: dto.status },
      });
      return toResponse(saved, user);
    });
  }

  /**
   * Historique de consultation (R28.4, M24 : SUPER_ADMIN et AUDITOR) : audits `document.*`
   * du document. La visibilité M9 s'applique ; un document invisible renvoie 404.
   */
  async getHistory(id: string, user: AuthenticatedUser): Promise<DocumentHistoryEntryDto[]> {
    await this.findVisibleDocument(id, user);
    const logs = await this.prisma.auditLog.findMany({
      where: { resourceType: 'Document', resourceId: id, action: { startsWith: 'document.' } },
      include: { actor: { select: { id: true, username: true } } },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.actor,
      sourceIp: log.sourceIp,
      timestamp: log.timestamp.toISOString(),
    }));
  }

  async getPermissions(id: string, user: AuthenticatedUser): Promise<DocumentPermissionResponseDto[]> {
    const document = await this.findVisibleDocument(id, user);
    if (!canShare(document, user)) throw new ForbiddenException();
    const permissions = await this.prisma.documentPermission.findMany({
      where: { documentId: id },
      orderBy: { grantedAt: 'asc' },
    });
    const users = await this.permissionUsers(permissions.map(({ userId }) => userId));
    return permissions.map((permission) =>
      toPermissionResponse(permission, users.get(permission.userId)),
    );
  }

  async getShareRecipients(id: string, user: AuthenticatedUser): Promise<DocumentShareRecipientDto[]> {
    const document = await this.findVisibleDocument(id, user);
    if (!canShare(document, user)) throw new ForbiddenException();
    const recipients = await this.prisma.user.findMany({
      where: { id: { not: user.id } },
      select: {
        id: true,
        username: true,
        employeeIdentity: {
          include: { employee: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { username: 'asc' },
    });
    return recipients.map(({ id: recipientId, username, employeeIdentity }) => ({
      id: recipientId,
      username,
      displayName: employeeIdentity
        ? `${employeeIdentity.employee.firstName} ${employeeIdentity.employee.lastName}`
        : username,
    }));
  }

  async grantPermission(
    id: string,
    dto: GrantPermissionDto,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<DocumentPermissionResponseDto> {
    const document = await this.findVisibleDocument(id, user);
    if (!canShare(document, user)) throw new ForbiddenException();
    const beneficiary = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
    if (!beneficiary) throw new BusinessRuleException('Compte utilisateur invalide.');

    return this.prisma.$transaction(async (tx) => {
      let permission: DocumentPermissionRecord;
      try {
        permission = await tx.documentPermission.create({
          data: {
            documentId: id,
            userId: dto.userId,
            permission: dto.permission,
            grantedBy: user.id,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Cette permission existe déjà.');
        }
        throw error;
      }
      await this.audit.record(tx, {
        ...auditEntry(user, 'document.share', id, sourceIp),
        newValues: { documentId: id, userId: dto.userId, permission: dto.permission },
      });
      // M19 : le bénéficiaire du partage est notifié, dans la transaction du partage
      await this.notifications.notify(tx, [dto.userId], {
        type: NotificationType.DOCUMENT_SHARED,
        title: 'Document partagé avec vous',
        message: `${user.username} vous a donné un accès en ${SHARE_LABELS[dto.permission]} au document « ${document.title} ».`,
      });
      const users = await this.permissionUsers([permission.userId]);
      return toPermissionResponse(permission, users.get(permission.userId));
    });
  }

  async revokePermission(id: string, permissionId: string, user: AuthenticatedUser, sourceIp: string) {
    await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: { AND: [{ id }, buildVisibilityWhere(user)] },
        include: DOCUMENT_INCLUDE,
      });
      if (!document) throw new NotFoundException('Document introuvable.');
      if (!canShare(document, user)) throw new ForbiddenException();
      const permission = await tx.documentPermission.findFirst({ where: { id: permissionId, documentId: id } });
      if (!permission) throw new NotFoundException('Permission introuvable.');
      await this.audit.record(tx, {
        ...auditEntry(user, 'document.share', id, sourceIp),
        oldValues: { documentId: id, userId: permission.userId, permission: permission.permission },
      });
      await tx.documentPermission.delete({ where: { id: permissionId } });
    });
  }

  async remove(id: string, user: AuthenticatedUser, sourceIp: string): Promise<void> {
    const storagePath = await this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: { AND: [{ id }, buildVisibilityWhere(user)] },
        include: DOCUMENT_INCLUDE,
      });
      if (!document) throw new NotFoundException('Document introuvable.');
      if (!canDelete(document, user)) throw new ForbiddenException();
      await this.audit.record(tx, {
        ...auditEntry(user, 'document.delete', id, sourceIp),
        oldValues: { title: document.title, confidentialityLevel: document.confidentialityLevel },
      });
      await tx.document.delete({ where: { id } });
      return document.storagePath;
    });
    await deleteDocumentFile(storagePath);
  }

  /**
   * GFEP-670 : fil de commentaires sur un document (AppFlow §3.8).
   * Les validateurs doivent pouvoir commenter avant validation ; les commentaires
   * sont visibles de tous ceux qui peuvent voir le document.
   */
  async createComment(
    id: string,
    content: string,
    user: AuthenticatedUser,
    sourceIp: string,
  ): Promise<DocumentCommentDto> {
    await this.findVisibleDocument(id, user);
    const comment = await this.prisma.documentComment.create({
      data: { documentId: id, authorId: user.id, content },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            employeeIdentity: {
              include: { employee: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
    await this.prisma.$transaction(async (tx) => {
      await this.audit.record(tx, {
        ...auditEntry(user, 'document.comment', id, sourceIp),
        newValues: { commentId: comment.id, length: content.length },
      });
    });
    return toCommentResponse(comment);
  }

  async listComments(id: string, user: AuthenticatedUser): Promise<DocumentCommentDto[]> {
    await this.findVisibleDocument(id, user);
    const comments = await this.prisma.documentComment.findMany({
      where: { documentId: id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            employeeIdentity: {
              include: { employee: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return comments.map(toCommentResponse);
  }

  private async findVisibleDocument(id: string, user: AuthenticatedUser): Promise<DocumentWithRelations> {
    const document = await this.prisma.document.findFirst({
      where: { AND: [{ id }, buildVisibilityWhere(user)] },
      include: DOCUMENT_INCLUDE,
    });
    if (!document) throw new NotFoundException('Document introuvable.');
    return document;
  }

  private async permissionUsers(userIds: string[]): Promise<Map<string, UserForPermission>> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        employeeIdentity: { include: { employee: { select: { firstName: true, lastName: true } } } },
      },
    });
    return new Map(users.map((user) => [user.id, user]));
  }
}

function toResponse(document: DocumentWithRelations, user: AuthenticatedUser): DocumentResponseDto {
  const accessRecord = {
    ownerId: document.ownerId,
    category: { departmentId: document.category.departmentId },
    owner: { departmentId: document.owner.departmentId },
    permissions: document.permissions,
  };
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    category: { id: document.category.id, name: document.category.name },
    department: document.category.department ?? document.owner.department,
    owner: {
      id: document.owner.id,
      firstName: document.owner.firstName,
      lastName: document.owner.lastName,
    },
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    confidentialityLevel: document.confidentialityLevel,
    validationStatus: document.validationStatus,
    createdAt: document.createdAt.toISOString(),
    capabilities: {
      canDownload: true,
      canPreview: previewableMimeType(document.mimeType),
      canValidate:
        document.validationStatus === DocumentValidationStatus.PENDING && canValidate(accessRecord, user),
      canShare: canShare(accessRecord, user),
      canDelete: canDelete(accessRecord, user),
    },
  };
}

function toPermissionResponse(
  permission: DocumentPermissionRecord,
  user: UserForPermission | undefined,
): DocumentPermissionResponseDto {
  const employee = user?.employeeIdentity?.employee;
  return {
    id: permission.id,
    userId: permission.userId,
    username: user?.username ?? 'Compte supprimé',
    employee: employee ? { firstName: employee.firstName, lastName: employee.lastName } : null,
    permission: permission.permission,
    grantedAt: permission.grantedAt.toISOString(),
  };
}

function auditEntry(user: AuthenticatedUser, action: string, resourceId: string, sourceIp: string) {
  return {
    actorId: user.id,
    action,
    resourceType: 'Document',
    resourceId,
    sourceIp,
  };
}

function isSensitive(level: ConfidentialityLevel) {
  return level === ConfidentialityLevel.CONFIDENTIAL || level === ConfidentialityLevel.RESTRICTED;
}

function safeFilename(title: string): string {
  const safe = title.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^\.+|\.+$/g, '');
  return safe.slice(0, 100) || 'document';
}

function extensionForMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'image/png': 'png',
    'image/jpeg': 'jpg',
  };
  return extensions[mimeType] ?? 'bin';
}

function toCommentResponse(comment: {
  id: string;
  content: string;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    employeeIdentity: { employee: { firstName: string; lastName: string } } | null;
  };
}): DocumentCommentDto {
  const employee = comment.author.employeeIdentity?.employee;
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.author.id,
      username: comment.author.username,
      displayName: employee ? employee.firstName + ' ' + employee.lastName : comment.author.username,
    },
  };
}
