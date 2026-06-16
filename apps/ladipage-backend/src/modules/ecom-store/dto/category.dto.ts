import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator'

import { PagerDto } from '@liora/dto'

export class CategoryQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string
}

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  parentId?: number
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}