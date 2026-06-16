import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional } from 'class-validator'

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601)', example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  from?: string

  @ApiPropertyOptional({ description: 'End date (ISO 8601)', example: '2026-06-13' })
  @IsOptional()
  @IsDateString()
  to?: string
}