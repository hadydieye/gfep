import { Transform } from 'class-transformer';
import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

// DN : suite de composants `attribut=valeur` séparés par des virgules
export const DN_PATTERN = /^[A-Za-z][A-Za-z0-9-]*=[^,=+<>#;"\\]+(?:,\s*[A-Za-z][A-Za-z0-9-]*=[^,=+<>#;"\\]+)*$/;

export class CreateAdMappingDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  @Matches(DN_PATTERN)
  adGroupDn: string;

  @IsUUID()
  roleId: string;
}
