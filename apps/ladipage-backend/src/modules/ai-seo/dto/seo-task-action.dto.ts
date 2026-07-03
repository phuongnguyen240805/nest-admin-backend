import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

export class SeoTaskActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>
}
