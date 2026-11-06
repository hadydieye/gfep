import { TransactionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

/**
 * Montant décimal en chaîne (jamais un nombre flottant) : strictement positif,
 * au plus 2 décimales et 12 chiffres avant la virgule (Decimal(14,2), ≤ 999 999 999 999,99).
 */
export const AMOUNT_PATTERN = /^(?!0+(?:\.0{1,2})?$)(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @IsString()
  @Matches(AMOUNT_PATTERN)
  amount: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUUID()
  departmentId: string;
}
