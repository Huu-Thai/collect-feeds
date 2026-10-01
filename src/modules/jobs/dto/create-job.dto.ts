import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateJobDto {
  @ApiProperty({ example: 'Phishing.Database - IPs Active (daily)' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'phishing_database' })
  @IsString()
  type: string;

  @ApiProperty()
  @IsUUID()
  sourceId: string;

  @ApiPropertyOptional({
    example: '0 3 * * *',
    description: 'Cron expression; omit for manual-trigger-only',
  })
  @IsOptional()
  @IsString()
  schedule?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
