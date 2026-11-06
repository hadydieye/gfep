import { EmploymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsSortKey, IsSortOrder, type SortOrder } from '../../common/sorting.js';
import { EMPLOYEE_SORTS } from '../employee-sorting.js';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  status?: EmploymentStatus;

  @IsSortKey(EMPLOYEE_SORTS)
  sort?: string;

  @IsSortOrder()
  order?: SortOrder;
}
