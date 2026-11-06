import { InvoiceStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;
}
