import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

import { PagerDto } from '@liora/dto'

import { CustomFieldDataType, EcomEntityType } from '../common/enums'

export class CustomFieldQueryDto extends PagerDto {
  @ApiProperty({ enum: EcomEntityType })
  @IsEnum(EcomEntityType)
  entity: EcomEntityType
}

export class CreateCustomFieldDto {
  @ApiProperty({ enum: EcomEntityType })
  @IsEnum(EcomEntityType)
  entity: EcomEntityType

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  fieldName: string

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  displayName: string

  @ApiPropertyOptional({ enum: CustomFieldDataType })
  @IsOptional()
  @IsEnum(CustomFieldDataType)
  dataType?: CustomFieldDataType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[]
}

export class UpdateCustomFieldDto extends PartialType(CreateCustomFieldDto) {}