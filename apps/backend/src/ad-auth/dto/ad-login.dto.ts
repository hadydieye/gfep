import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class AdLoginDto {
  // Identifiant d'annuaire : lettres, chiffres, point, tiret, souligné (l'échappement RFC 4515 reste appliqué)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/)
  username: string;

  // Jamais vide : un bind avec mot de passe vide serait un bind anonyme (design §9.3)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}
