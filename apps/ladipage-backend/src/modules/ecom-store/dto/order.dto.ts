import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

import { PagerDto } from '@liora/dto'

import { OrderStatus } from '../common/enums'

export class OrderQueryDto extends PagerDto {
  @ApiPropertyOptional({ description: 'Filter by status or "incomplete"' })
  @IsOptional()
  @IsString()
  status?: string
}

export class CreateOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  productId?: number

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  productName: string

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  customerName: string

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  customerPhone: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isIncomplete?: boolean

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[]

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[]
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus
}