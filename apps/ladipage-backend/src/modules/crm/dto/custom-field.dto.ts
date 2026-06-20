import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

import { PagerDto } from '@liora/dto'

import { IsBoolean } from 'class-validator'

import { CustomerCustomFieldDataType } from '../common/enums'

export class CustomFieldQueryDto extends PagerDto {
  @ApiPropertyOptional({ enum: ['person', 'opportunity'] })
  @IsOptional()
  @IsString()
  targetType?: 'person' | 'opportunity'
}

export class CreateCustomFieldDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  fieldName: string

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  displayName: string

  @ApiPropertyOptional({ enum: CustomerCustomFieldDataType })
  @IsOptional()
  @IsEnum(CustomerCustomFieldDataType)
  dataType?: CustomerCustomFieldDataType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[]

  @ApiPropertyOptional({ enum: ['person', 'opportunity'] })
  @IsOptional()
  @IsString()
  targetType?: 'person' | 'opportunity'

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean
}

export class UpdateCustomFieldDto extends PartialType(CreateCustomFieldDto) {}