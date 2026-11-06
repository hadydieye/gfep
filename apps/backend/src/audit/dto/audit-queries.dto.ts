import { AuthEventType, SecuritySeverity } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

class PeriodQueryDto {
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

  /** Date minimale (AAAA-MM-JJ, incluse) */
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @MaxLength(10)
  from?: string;

  /** Date maximale (AAAA-MM-JJ, incluse) */
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @MaxLength(10)
  to?: string;
}

export class ListAuditLogsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  /** Identifiant de connexion de l'auteur (recherche partielle) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  actor?: string;

  /** Action exacte (`role.assign`) ou famille (`document.`) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  resourceType?: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;
}

export class ListSecurityEventsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsEnum(SecuritySeverity)
  severity?: SecuritySeverity;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  eventType?: string;
}

export class ListAuthEventsQueryDto extends PeriodQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Identifiant de connexion (recherche partielle) */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  user?: string;

  @IsOptional()
  @IsEnum(AuthEventType)
  eventType?: AuthEventType;
}
