import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Changement de mot de passe (N14). Les règles de politique (longueur, refus)
 * sont vérifiées par le service pour renvoyer un message actionnable ; la
 * validation ne fait que borner la taille des entrées.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  newPassword: string;
}
