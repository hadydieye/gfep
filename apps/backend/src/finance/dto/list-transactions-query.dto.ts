import { TransactionStatus, TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { IsSortKey, IsSortOrder, type SortOrder } from '../../common/sorting.js';
import { TRANSACTION_SORTS } from '../finance-sorting.js';

export class ListTransactionsQueryDto {
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
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Date de création minimale (AAAA-MM-JJ, incluse) */
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @MaxLength(10)
  from?: string;

  /** Date de création maximale (AAAA-MM-JJ, incluse) */
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @MaxLength(10)
  to?: string;

  /** Recherche sur la référence */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsSortKey(TRANSACTION_SORTS)
  sort?: string;

  @IsSortOrder()
  order?: SortOrder;
}
