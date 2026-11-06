import { InvoiceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListInvoicesQueryDto {
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
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Échéance minimale (AAAA-MM-JJ, incluse) */
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @MaxLength(10)
  dueFrom?: string;

  /** Échéance maximale (AAAA-MM-JJ, incluse) */
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @MaxLength(10)
  dueTo?: string;

  /** Recherche sur le nom du client */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
