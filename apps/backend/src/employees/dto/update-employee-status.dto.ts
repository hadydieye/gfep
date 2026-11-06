import { EmploymentStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateEmployeeStatusDto {
  @IsEnum(EmploymentStatus)
  status: EmploymentStatus;
}
