import { DocumentValidationStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateValidationDto {
  @IsIn([DocumentValidationStatus.VALIDATED, DocumentValidationStatus.REJECTED])
  status: DocumentValidationStatus;
}