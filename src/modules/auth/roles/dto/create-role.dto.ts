import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Administrator' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(2)
  key: string;
}
