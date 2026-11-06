import { IsInt, Max, Min } from 'class-validator';

/**
 * Modification de la durée de session (N16) : entier de 1 à 12 heures.
 * Les autres paramètres de configuration sont en lecture seule.
 */
export class UpdateSettingsDto {
  @IsInt()
  @Min(1)
  @Max(12)
  sessionTtlHours: number;
}
