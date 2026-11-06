import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsUUID('all', { each: true })
  roleIds: string[];
}
