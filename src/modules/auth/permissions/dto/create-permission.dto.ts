import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Matches } from 'class-validator';

const PERMISSION_KEYS = ['read', 'write', '*'] as const;
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', '*'] as const;

export class CreatePermissionDto {
  @ApiProperty({ enum: PERMISSION_KEYS })
  @IsIn(PERMISSION_KEYS)
  key: (typeof PERMISSION_KEYS)[number];

  @ApiProperty({ enum: HTTP_METHODS })
  @IsIn(HTTP_METHODS)
  method: (typeof HTTP_METHODS)[number];

  @ApiProperty({
    example: '/feeds/*',
    description:
      'Path relative to the API prefix; "/*" suffix matches any sub-path',
  })
  @IsString()
  @Matches(/^\//, { message: 'path must start with /' })
  path: string;

  @ApiProperty()
  @IsUUID()
  roleId: string;
}
