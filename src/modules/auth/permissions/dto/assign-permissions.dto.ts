import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { HTTP_METHODS, PERMISSION_KEYS } from './create-permission.dto';

export class PermissionItemDto {
  @ApiProperty({ enum: PERMISSION_KEYS })
  @IsIn(PERMISSION_KEYS)
  key: (typeof PERMISSION_KEYS)[number];

  @ApiProperty({ enum: HTTP_METHODS })
  @IsIn(HTTP_METHODS)
  method: (typeof HTTP_METHODS)[number];

  @ApiProperty({ example: '/feeds/*' })
  @IsString()
  @Matches(/^\//, { message: 'path must start with /' })
  path: string;
}

export class AssignPermissionsDto {
  @ApiProperty()
  @IsUUID()
  roleId: string;

  @ApiProperty({
    type: [PermissionItemDto],
    description: "Replaces the role's entire permission set with this list",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions: PermissionItemDto[];
}
