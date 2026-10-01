import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSourceDto {
  @ApiProperty({ example: 'Phishing.Database - IPs Active' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'phishing_database' })
  @IsString()
  type: string;

  @ApiProperty({
    example: {
      url: 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-IPs-ACTIVE.txt',
      indicatorType: 'IPV4',
      status: 'ACTIVE',
    },
  })
  @IsObject()
  params: Record<string, any>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
