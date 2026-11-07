import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from '../../employees/dto/create-employee.dto.js';

/**
 * GFEP-655 : fiche employé en self-service (N15).
 * L'employé peut corriger lui-même ses données depuis son profil. Les champs
 * d'identification (numéro, email professionnel) restent gérés par les RH.
 */
export class UpdateOwnProfileDto extends PartialType(
  OmitType(CreateEmployeeDto, ['professionalEmail'] as const),
) {}
