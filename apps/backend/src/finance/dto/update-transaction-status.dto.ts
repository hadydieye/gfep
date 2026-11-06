import { TransactionStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateTransactionStatusDto {
  @IsIn([TransactionStatus.VALIDATED, TransactionStatus.REJECTED])
  status: TransactionStatus;
}
