import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

import { PagerDto } from '@liora/dto'

import { EcomEntityType } from '../common/enums'

export class TagQueryDto extends PagerDto {
  @ApiProperty({ enum: EcomEntityType })
  @IsEnum(EcomEntityType)
  entity: EcomEntityType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string
}

export class CreateTagDto {
  @ApiProperty({ enum: EcomEntityType })
  @IsEnum(EcomEntityType)
  entity: EcomEntityType

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string

  @ApiPropertyOptional({ description: 'Order tag color (hex), ignored for product tags' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string
}

export class UpdateTagDto extends PartialType(
  CreateTagDto,
) {}