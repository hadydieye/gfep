import { ConfidentialityLevel, DocumentValidationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsSortKey, IsSortOrder, type SortOrder } from '../../common/sorting.js';
import { DOCUMENT_SORTS } from '../document-sorting.js';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit = 25;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @IsOptional()
  @IsEnum(DocumentValidationStatus)
  validationStatus?: DocumentValidationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Propriétaire du document (fiche employé, N11) */
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  /** Département du document au sens de M8 (détail de département, N11) */
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsSortKey(DOCUMENT_SORTS)
  sort?: string;

  @IsSortOrder()
  order?: SortOrder;
}