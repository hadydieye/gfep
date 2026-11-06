import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  permissionIds: string[];
}
