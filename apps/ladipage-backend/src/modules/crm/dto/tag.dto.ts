import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

import { PagerDto } from '@liora/dto'

export class TagQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string
}

export class CreateTagDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string
}

export class UpdateTagDto extends PartialType(CreateTagDto) {}