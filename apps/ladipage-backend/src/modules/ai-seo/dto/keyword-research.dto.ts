import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class KeywordResearchDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  seeds: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(700)
  limit?: number
}
