import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchEmployeeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  q?: string;
}
