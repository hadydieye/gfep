import { ConfidentialityLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  categoryId: string;

  @IsEnum(ConfidentialityLevel)
  confidentialityLevel: ConfidentialityLevel;
}