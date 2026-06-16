import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

import { PagerDto } from '@liora/dto'

export class SegmentQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string
}

export class CreateSegmentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>
}

export class UpdateSegmentDto extends PartialType(CreateSegmentDto) {}