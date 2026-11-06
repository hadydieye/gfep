import { AuthProvider, UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListUsersQueryDto {
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
  roleId?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(AuthProvider)
  authProvider?: AuthProvider;

  /** Recherche sur l'identifiant, l'email, le prénom ou le nom */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
