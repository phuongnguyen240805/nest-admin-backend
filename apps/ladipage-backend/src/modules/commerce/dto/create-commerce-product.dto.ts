import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class CreateCommerceProductDto {
  @ApiProperty()
  @IsString()
  title: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  compareAtPrice?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortDescription?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[]

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  badge?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingNote?: string

  @ApiPropertyOptional({ enum: ['published', 'draft', 'archived'] })
  @IsOptional()
  @IsIn(['published', 'draft', 'archived'])
  status?: 'published' | 'draft' | 'archived'
}
