import { ConfidentialityLevel, DocumentPermissionType, DocumentValidationStatus } from '@prisma/client';

export class DocumentResponseDto {
  id: string;
  title: string;
  description: string | null;
  category: { id: string; name: string };
  department: { id: string; name: string };
  owner: { id: string; firstName: string; lastName: string };
  mimeType: string;
  fileSize: number;
  confidentialityLevel: ConfidentialityLevel;
  validationStatus: DocumentValidationStatus;
  createdAt: string;
  capabilities: {
    canDownload: boolean;
    canPreview: boolean;
    canValidate: boolean;
    canShare: boolean;
    canDelete: boolean;
  };
}

export class PaginatedDocumentsDto {
  data: DocumentResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export class DocumentCategoryDto {
  id: string;
  name: string;
  department: { id: string; name: string } | null;
  canUpload: boolean;
}

export class DocumentPermissionResponseDto {
  id: string;
  userId: string;
  username: string;
  employee: { firstName: string; lastName: string } | null;
  permission: DocumentPermissionType;
  grantedAt: string;
}

export class DocumentShareRecipientDto {
  id: string;
  username: string;
  displayName: string;
}
export interface DocumentHistoryEntryDto {
  id: string;
  action: string;
  actor: { id: string; username: string };
  sourceIp: string;
  timestamp: string;
}
