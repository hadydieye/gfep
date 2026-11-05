import { DocumentPermissionType } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class GrantPermissionDto {
  @IsUUID()
  userId: string;

  @IsEnum(DocumentPermissionType)
  permission: DocumentPermissionType;
}