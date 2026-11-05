import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  professionalEmail: string;

  // Région GN : accepte le format local guinéen comme le format international
  @IsOptional()
  @IsPhoneNumber('GN')
  phone?: string | null;

  @IsUUID()
  departmentId: string;

  @IsUUID()
  positionId: string;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsDateString()
  hireDate: string;
}
