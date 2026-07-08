import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator'

export class LandingAiJobParamsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  style?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prompt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cloneMode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offer?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cta?: string
}

export class CreateLandingAiJobDto {
  @ApiProperty({ enum: ['ai', 'clone', 'ppc'] })
  @IsIn(['ai', 'clone', 'ppc'])
  type: 'ai' | 'clone' | 'ppc'

  @ApiProperty()
  @IsString()
  name: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[]

  @ApiPropertyOptional({ enum: ['preserve', 'convert'] })
  @IsOptional()
  @IsIn(['preserve', 'convert'])
  importMode?: 'preserve' | 'convert'

  @ApiProperty({ type: LandingAiJobParamsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => LandingAiJobParamsDto)
  params: LandingAiJobParamsDto
}