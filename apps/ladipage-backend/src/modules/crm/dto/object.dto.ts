import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator'

import { PagerDto } from '@liora/dto'

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'LIST', 'BOOLEAN'] as const

export class ObjectQueryDto extends PagerDto {}

export class CreateFieldDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  fieldSlug: string

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  label: string

  @ApiPropertyOptional({ enum: FIELD_TYPES })
  @IsOptional()
  @IsIn(FIELD_TYPES)
  dataType?: (typeof FIELD_TYPES)[number]

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number
}

export class CreateObjectDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  slug: string

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  label: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ type: [CreateFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFieldDto)
  fields?: CreateFieldDto[]
}

export class UpdateObjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string
}

export class UpdateFieldDto extends PartialType(CreateFieldDto) {
  declare fieldSlug?: never
}

export class RecordQueryDto extends PagerDto {}

export class CreateRecordDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data: Record<string, unknown>
}

export class UpdateRecordDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data: Record<string, unknown>
}