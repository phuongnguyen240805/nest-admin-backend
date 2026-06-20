import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { PagerDto } from '@liora/dto'

export class OpportunityQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stageId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string
}

export class CreateOpportunityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string

  @ApiPropertyOptional({ description: 'Amount in VND' })
  @IsOptional()
  @IsNumber()
  amount?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closeDate?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  stageId?: string

  @ApiPropertyOptional({ example: 'new' })
  @IsOptional()
  @IsString()
  stageSlug?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number
}

export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}

export class MoveOpportunityStageDto {
  @ApiProperty()
  @IsUUID()
  stageId: string
}