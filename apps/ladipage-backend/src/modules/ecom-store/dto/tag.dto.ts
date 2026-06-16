import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

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
}

export class UpdateTagDto extends PartialType(
  CreateTagDto,
) {}